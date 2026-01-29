import http from "http";
import type { AddressInfo, Server } from "net";
import { Readable } from "stream";
import { ffsFetch } from "./fetch";

/**
 * HTTP proxy for FFmpeg URL handling.
 *
 * Static FFmpeg binaries can have DNS resolution issues on Alpine Linux (musl libc).
 * This proxy lets Node.js handle DNS lookups instead of FFmpeg by proxying HTTP
 * requests through localhost.
 *
 * URL scheme (M3U8-compatible):
 * - Original:  https://cdn.example.com/path/to/stream.m3u8
 * - Proxy:     http://127.0.0.1:{port}/https://cdn.example.com/path/to/stream.m3u8
 * - Relative:  segment-0.ts → http://127.0.0.1:{port}/https://cdn.example.com/path/to/segment-0.ts
 */
export class HttpProxy {
  private server: Server | null = null;
  private _port: number | null = null;
  private startPromise: Promise<void> | null = null;

  get port(): number | null {
    return this._port;
  }

  /**
   * Transform a URL to go through the proxy.
   * @throws Error if proxy not started
   */
  transformUrl(url: string): string {
    if (this._port === null) throw new Error("Proxy not started");
    return `http://127.0.0.1:${this._port}/${url}`;
  }

  /**
   * Start the proxy server. Safe to call multiple times.
   */
  async start(): Promise<void> {
    if (this._port !== null) return;
    if (this.startPromise) {
      await this.startPromise;
      return;
    }
    this.startPromise = this.doStart();
    await this.startPromise;
  }

  private async doStart(): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      try {
        const originalUrl = this.parseProxyPath(req.url || "");
        if (!originalUrl) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request: invalid proxy path");
          return;
        }

        const response = await ffsFetch(originalUrl, {
          method: req.method as "GET" | "HEAD" | undefined,
          headers: this.filterHeaders(req.headers),
          bodyTimeout: 0, // No timeout for streaming
        });

        // Convert response headers to plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        res.writeHead(response.status, headers);

        if (response.body) {
          const nodeStream = Readable.fromWeb(response.body);
          nodeStream.pipe(res);
          nodeStream.on("error", (err) => {
            console.error("Proxy stream error:", err);
            res.destroy();
          });
        } else {
          res.end();
        }
      } catch (err) {
        console.error("Proxy request error:", err);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Bad Gateway");
        } else {
          res.destroy();
        }
      }
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, "127.0.0.1", () => {
        this._port = (this.server!.address() as AddressInfo).port;
        resolve();
      });
    });
  }

  /**
   * Parse the proxy path to extract the original URL.
   * Path format: /{originalUrl}
   */
  private parseProxyPath(path: string): string | null {
    if (!path.startsWith("/http://") && !path.startsWith("/https://")) {
      return null;
    }
    return path.slice(1); // Remove leading /
  }

  /**
   * Filter headers to forward to the upstream server.
   * Removes hop-by-hop headers that shouldn't be forwarded.
   */
  private filterHeaders(
    headers: http.IncomingHttpHeaders,
  ): Record<string, string> {
    const skip = new Set([
      "host",
      "connection",
      "keep-alive",
      "transfer-encoding",
      "te",
      "trailer",
      "upgrade",
      "proxy-authorization",
      "proxy-authenticate",
    ]);

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!skip.has(key.toLowerCase()) && typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Close the proxy server and reset state.
   */
  close(): void {
    this.server?.close();
    this.server = null;
    this._port = null;
    this.startPromise = null;
  }
}

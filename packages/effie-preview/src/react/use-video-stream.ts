import { useEffect, useRef, useState } from "react";

export type UseVideoStreamResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isFullyBuffered: boolean;
  blobRef: React.RefObject<Blob | null>;
};

/**
 * Streams a video URL into a `<video>` element using MediaSource Extensions.
 * Falls back to a blob URL if MSE is unavailable or fails mid-stream.
 *
 * This avoids follow-up network requests on seek, which is critical for
 * one-time-consumption URLs like FFS render endpoints.
 */
export function useVideoStream(url: string | null): UseVideoStreamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [isFullyBuffered, setIsFullyBuffered] = useState(false);
  const lastUrlRef = useRef<string | null>(null);

  // Reset buffered state when URL changes
  if (url !== lastUrlRef.current) {
    lastUrlRef.current = url;
    if (isFullyBuffered) setIsFullyBuffered(false);
    blobRef.current = null;
  }

  useEffect(() => {
    if (!url) return;
    const video = videoRef.current;
    if (!video) return;

    const controller = new AbortController();
    const objectUrls: string[] = [];

    // ManagedMediaSource is Safari's preferred MSE API
    const MS =
      typeof window !== "undefined" && "ManagedMediaSource" in window
        ? (window as unknown as { ManagedMediaSource: typeof MediaSource })
            .ManagedMediaSource
        : typeof MediaSource !== "undefined"
          ? MediaSource
          : null;
    const mimeCodec = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
    const canMSE = MS && MS.isTypeSupported(mimeCodec);

    const setBlobSrc = (chunks: Uint8Array[]) => {
      if (controller.signal.aborted) return;
      const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);
      objectUrls.push(blobUrl);
      video.src = blobUrl;
    };

    const streamVideo = async (
      sourceBuffer: SourceBuffer | null,
      mediaSource: MediaSource | null,
      msUrl: string | null,
    ) => {
      const chunks: Uint8Array[] = [];
      let mseFailed = !sourceBuffer;

      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch {
        return;
      }
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          if (sourceBuffer && !mseFailed) {
            try {
              await new Promise<void>((resolve, reject) => {
                const onDone = () => {
                  sourceBuffer.removeEventListener("error", onError);
                  resolve();
                };
                const onError = () => {
                  sourceBuffer.removeEventListener("updateend", onDone);
                  reject(new Error("SourceBuffer append failed"));
                };
                sourceBuffer.addEventListener("updateend", onDone, {
                  once: true,
                });
                sourceBuffer.addEventListener("error", onError, {
                  once: true,
                });
                sourceBuffer.appendBuffer(value as BufferSource);
              });
            } catch (e) {
              console.warn("MSE: append failed, will use blob fallback", e);
              mseFailed = true;
            }
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      if (controller.signal.aborted) return;

      if (mseFailed) {
        if (msUrl) {
          URL.revokeObjectURL(msUrl);
        }
        setBlobSrc(chunks);
      } else if (mediaSource && mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }

      blobRef.current = new Blob(chunks as BlobPart[], { type: "video/mp4" });
      setIsFullyBuffered(true);
    };

    if (canMSE) {
      const mediaSource = new MS();
      const msUrl = URL.createObjectURL(mediaSource);
      objectUrls.push(msUrl);
      video.src = msUrl;

      mediaSource.addEventListener("sourceopen", () => {
        let sourceBuffer: SourceBuffer | null = null;
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        } catch (e) {
          console.warn("MSE: addSourceBuffer failed", e);
        }
        streamVideo(sourceBuffer, mediaSource, msUrl);
      });
    } else {
      streamVideo(null, null, null);
    }

    return () => {
      controller.abort();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url]);

  return { videoRef, isFullyBuffered, blobRef };
}

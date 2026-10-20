// @vitest-environment jsdom
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQoiAsPngUrl } from "../qoi-image";
import { QoiAwareImg } from "./qoi-aware-img";

vi.mock("../qoi-image", () => ({ fetchQoiAsPngUrl: vi.fn() }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fetchQoi = vi.mocked(fetchQoiAsPngUrl);
const originalRevokeObjectURL = URL.revokeObjectURL;
let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  fetchQoi.mockReset();
  revokeObjectURL = vi.fn();
  URL.revokeObjectURL = revokeObjectURL;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = null;
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function render(element: React.ReactElement): HTMLImageElement {
  root ??= createRoot(container);
  act(() => root!.render(element));
  return container.querySelector("img")!;
}

/** Fire an image event and let the fallback's promise settle. */
async function fire(img: HTMLImageElement, type: "load" | "error") {
  await act(async () => {
    img.dispatchEvent(new Event(type));
  });
}

describe("QoiAwareImg", () => {
  it("renders the same markup as a plain <img> on the server", () => {
    const props = {
      src: "/image.png",
      alt: "An image",
      className: "preview",
      style: { height: 10 },
    };
    const html = renderToString(<QoiAwareImg {...props} />);
    expect(html).toBe(renderToString(<img {...props} />));
    expect(html).toContain(
      '<img src="/image.png" alt="An image" class="preview" style="height:10px"/>',
    );
  });

  it("doesn't fetch an image the browser shows", async () => {
    const img = render(<QoiAwareImg src="/image.png" alt="An image" />);

    await fire(img, "load");

    expect(img.getAttribute("src")).toBe("/image.png");
    expect(fetchQoi).not.toHaveBeenCalled();
  });

  it("shows a QOI image as PNG when the browser can't decode it", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const onError = vi.fn();
    const img = render(
      <QoiAwareImg
        src="/image.qoi"
        alt="An image"
        className="preview"
        onError={onError}
      />,
    );

    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledExactlyOnceWith("/image.qoi", {
      signal: expect.any(AbortSignal),
    });
    expect(img.getAttribute("src")).toBe("blob:png");
    expect(img.getAttribute("alt")).toBe("An image");
    expect(img.className).toBe("preview");
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError for a broken image that isn't QOI", async () => {
    fetchQoi.mockResolvedValue(null);
    const onError = vi.fn();
    const img = render(<QoiAwareImg src="/broken.png" onError={onError} />);

    await fire(img, "error");

    expect(onError).toHaveBeenCalledOnce();
    expect(img.getAttribute("src")).toBe("/broken.png");
  });

  it("calls onError when the image can't be fetched", async () => {
    fetchQoi.mockRejectedValue(new Error("Failed to fetch image: Not Found"));
    const onError = vi.fn();
    const img = render(<QoiAwareImg src="/missing.qoi" onError={onError} />);

    await fire(img, "error");

    expect(onError).toHaveBeenCalledOnce();
  });

  it("tries the fallback once per src", async () => {
    fetchQoi.mockResolvedValue(null);
    const onError = vi.fn();
    const img = render(<QoiAwareImg src="/broken.png" onError={onError} />);

    await fire(img, "error");
    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("calls onError when the converted PNG fails too", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const onError = vi.fn();
    const img = render(<QoiAwareImg src="/image.qoi" onError={onError} />);
    await fire(img, "error");

    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("revokes the PNG and starts over when the src changes", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    let img = render(<QoiAwareImg src="/first.qoi" />);
    await fire(img, "error");
    expect(img.getAttribute("src")).toBe("blob:png");

    img = render(<QoiAwareImg src="/second.png" />);

    expect(img.getAttribute("src")).toBe("/second.png");
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:png");

    fetchQoi.mockResolvedValue("blob:second");
    await fire(img, "error");
    expect(fetchQoi).toHaveBeenLastCalledWith("/second.png", {
      signal: expect.any(AbortSignal),
    });
  });

  it("revokes the PNG on unmount", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const img = render(<QoiAwareImg src="/image.qoi" />);
    await fire(img, "error");

    act(() => root!.unmount());
    root = null;

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:png");
  });

  it("aborts a conversion still running on unmount, and revokes its PNG", async () => {
    let resolve!: (url: string) => void;
    fetchQoi.mockReturnValue(new Promise((r) => (resolve = r)));
    const img = render(<QoiAwareImg src="/image.qoi" />);
    await fire(img, "error");
    const { signal } = fetchQoi.mock.calls[0][1]!;

    act(() => root!.unmount());
    root = null;
    expect(signal!.aborted).toBe(true);

    await act(async () => resolve("blob:late"));
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:late");
  });

  it("converts a QOI image that failed before hydration", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const element = <QoiAwareImg src="/image.qoi" alt="An image" />;
    container.innerHTML = renderToString(element);
    const img = container.querySelector("img")!;
    // The browser gave up on it before React was listening.
    Object.defineProperty(img, "complete", { value: true });

    await act(async () => {
      root = hydrateRoot(container, element);
    });

    expect(fetchQoi).toHaveBeenCalledOnce();
    expect(img.getAttribute("src")).toBe("blob:png");
  });

  it("holds back an error event while a conversion is running, dropping it when the conversion succeeds", async () => {
    let resolve!: (url: string) => void;
    fetchQoi.mockReturnValue(new Promise((r) => (resolve = r)));
    const onError = vi.fn();
    const element = <QoiAwareImg src="/image.qoi" onError={onError} />;
    container.innerHTML = renderToString(element);
    const img = container.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true });
    await act(async () => {
      root = hydrateRoot(container, element);
    });
    expect(fetchQoi).toHaveBeenCalledOnce();

    // The error event the browser queued arrives after the check on mount.
    await fire(img, "error");
    await act(async () => resolve("blob:png"));

    expect(fetchQoi).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(img.getAttribute("src")).toBe("blob:png");
  });

  it("forwards a held-back error event once when the image isn't QOI", async () => {
    let resolve!: (url: string | null) => void;
    fetchQoi.mockReturnValue(new Promise((r) => (resolve = r)));
    const onError = vi.fn();
    const img = render(<QoiAwareImg src="/broken.png" onError={onError} />);

    await fire(img, "error");
    await fire(img, "error");
    expect(onError).not.toHaveBeenCalled();
    await act(async () => resolve(null));

    expect(fetchQoi).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("fetches the srcSet candidate the browser selected, not src", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const img = render(
      <QoiAwareImg src="/image.png" srcSet="/image.png 1x, /image@2x.qoi 2x" />,
    );
    // At 2x, the browser picked the QOI candidate.
    Object.defineProperty(img, "currentSrc", {
      value: "http://localhost/image@2x.qoi",
    });

    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledExactlyOnceWith(
      "http://localhost/image@2x.qoi",
      { signal: expect.any(AbortSignal) },
    );
    expect(img.getAttribute("src")).toBe("blob:png");
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  it("fetches src when no candidate was selected yet", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const img = render(
      <QoiAwareImg src="/image.qoi" srcSet="/image.qoi 1x, /image@2x.qoi 2x" />,
    );
    expect(img.currentSrc).toBe("");

    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledExactlyOnceWith("/image.qoi", {
      signal: expect.any(AbortSignal),
    });
  });

  it("falls back for an image with only a srcSet", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const img = render(<QoiAwareImg srcSet="/image.qoi 1x" />);
    Object.defineProperty(img, "currentSrc", {
      value: "http://localhost/image.qoi",
    });

    await fire(img, "error");

    expect(fetchQoi).toHaveBeenCalledWith("http://localhost/image.qoi", {
      signal: expect.any(AbortSignal),
    });
    expect(img.getAttribute("src")).toBe("blob:png");
  });

  it("starts over when srcSet changes", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    let img = render(<QoiAwareImg src="/image.qoi" srcSet="/image.qoi 1x" />);
    await fire(img, "error");
    expect(img.getAttribute("src")).toBe("blob:png");

    img = render(
      <QoiAwareImg src="/image.qoi" srcSet="/image.qoi 1x, /image@2x.qoi 2x" />,
    );

    expect(img.getAttribute("src")).toBe("/image.qoi");
    expect(img.getAttribute("srcset")).toBe("/image.qoi 1x, /image@2x.qoi 2x");
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:png");

    await fire(img, "error");
    expect(fetchQoi).toHaveBeenCalledTimes(2);
  });

  it("drops srcSet and sizes once the PNG stands in, so the browser doesn't pick the QOI again", async () => {
    fetchQoi.mockResolvedValue("blob:png");
    const img = render(
      <QoiAwareImg
        src="/image.qoi"
        srcSet="/image.qoi 1x, /image@2x.qoi 2x"
        sizes="100vw"
        alt="An image"
      />,
    );
    expect(img.getAttribute("srcset")).toBe("/image.qoi 1x, /image@2x.qoi 2x");
    expect(img.getAttribute("sizes")).toBe("100vw");

    await fire(img, "error");

    expect(img.getAttribute("src")).toBe("blob:png");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.hasAttribute("sizes")).toBe(false);
    expect(img.getAttribute("alt")).toBe("An image");
  });

  it("fetches with the credentials crossOrigin asks for", async () => {
    fetchQoi.mockResolvedValue(null);
    const cases = [
      [undefined, undefined],
      ["use-credentials", "include"],
      ["anonymous", "same-origin"],
      ["", "same-origin"],
    ] as const;

    for (const [i, [crossOrigin, credentials]] of cases.entries()) {
      const img = render(
        <QoiAwareImg src={`/image-${i}.qoi`} crossOrigin={crossOrigin} />,
      );
      await fire(img, "error");
      const init = fetchQoi.mock.calls[i][1]!;
      expect(init.credentials).toBe(credentials);
      expect("credentials" in init).toBe(credentials !== undefined);
    }
  });
});

import { useEffect, useRef, useState } from "react";
import { fetchQoiAsPngUrl } from "../qoi-image";

export type QoiAwareImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * An `<img>` that can also show QOI images, which browsers can't decode.
 *
 * It renders a plain `<img>` with the given `src` first, so other images
 * load exactly as they would without it: no extra request, and the same
 * markup on the server. Only when the browser fails to show the image is
 * it fetched again; if the bytes are QOI, they're converted to a PNG that
 * takes the original's place, keeping the `<img>`'s sizing, `alt` and
 * styles. A QOI image is therefore fetched twice (the second time usually
 * from the HTTP cache), and it needs CORS when it's cross-origin.
 *
 * `onError` is called when the image can't be shown either way: it isn't
 * QOI, it can't be fetched, or it's an invalid QOI image.
 */
export function QoiAwareImg({ src, onError, ...props }: QoiAwareImgProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // The PNG standing in for a QOI src, keyed by that src
  const [converted, setConverted] = useState<{
    src: string;
    url: string;
  } | null>(null);
  // The src a fallback was attempted for, and how to abort it
  const attemptRef = useRef<{
    src: string;
    controller: AbortController;
  } | null>(null);

  const startFallback = (
    event: React.SyntheticEvent<HTMLImageElement, Event> | null,
  ) => {
    if (!src || attemptRef.current?.src === src) {
      if (event) onError?.(event);
      return;
    }
    const controller = new AbortController();
    attemptRef.current = { src, controller };
    fetchQoiAsPngUrl(src, { signal: controller.signal }).then(
      (url) => {
        if (controller.signal.aborted) {
          if (url) URL.revokeObjectURL(url);
        } else if (url) {
          setConverted({ src, url });
        } else if (event) {
          onError?.(event);
        }
      },
      () => {
        if (!controller.signal.aborted && event) onError?.(event);
      },
    );
  };

  useEffect(() => {
    // An image that failed before hydration fired its error event before
    // React listened for it, so check for one when the src is first shown.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      startFallback(null);
    }
    return () => {
      attemptRef.current?.controller.abort();
      attemptRef.current = null;
      setConverted(null);
    };
    // Only a new src starts over; startFallback is this render's, with its
    // props.
  }, [src]);

  useEffect(() => {
    if (!converted) return;
    const { url } = converted;
    return () => URL.revokeObjectURL(url);
  }, [converted]);

  const shown = converted && converted.src === src ? converted.url : src;

  return (
    <img
      ref={imgRef}
      src={shown}
      onError={(event) => {
        if (shown !== src) onError?.(event);
        else startFallback(event);
      }}
      {...props}
    />
  );
}

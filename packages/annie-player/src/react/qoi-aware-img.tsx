import { useEffect, useRef, useState } from "react";
import { fetchQoiAsPngUrl } from "../qoi-image";

export type QoiAwareImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

type ImgErrorEvent = React.SyntheticEvent<HTMLImageElement, Event>;

/**
 * The fetch credentials that match an `<img>`'s `crossOrigin`. Without one,
 * fetch's default applies.
 */
function credentialsFor(
  crossOrigin: QoiAwareImgProps["crossOrigin"],
): RequestCredentials | undefined {
  if (crossOrigin === undefined) return undefined;
  return crossOrigin === "use-credentials" ? "include" : "same-origin";
}

/**
 * An `<img>` that can also show QOI images, which browsers can't decode.
 *
 * It renders a plain `<img>` with the given `src` first, so other images
 * load exactly as they would without it: no extra request, and the same
 * markup on the server. Only when the browser fails to show the image is
 * it fetched again; if the bytes are QOI, they're converted to a PNG that
 * takes the original's place, keeping the `<img>`'s sizing, `alt` and
 * styles (but not `srcSet` and `sizes`, which would make the browser pick
 * a QOI candidate again). A QOI image is therefore fetched twice (the
 * second time usually from the HTTP cache), and it needs CORS when it's
 * cross-origin. The fetch sends credentials as `crossOrigin` says.
 *
 * `onError` is called when the image can't be shown either way: it isn't
 * QOI, it can't be fetched, or it's an invalid QOI image.
 */
export function QoiAwareImg({
  src,
  srcSet,
  sizes,
  onError,
  ...props
}: QoiAwareImgProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  // The PNG standing in for a QOI src, keyed by that src
  const [converted, setConverted] = useState<{
    src: string;
    url: string;
  } | null>(null);
  // The fallback attempted for a src: how to abort it, whether it has
  // finished, and an error event held back until it has, in case the
  // conversion succeeds after all
  const attemptRef = useRef<{
    src: string;
    controller: AbortController;
    settled: boolean;
    heldEvent: ImgErrorEvent | null;
  } | null>(null);

  const startFallback = (event: ImgErrorEvent | null) => {
    const attempt = attemptRef.current;
    if (attempt && attempt.src === src) {
      if (!attempt.settled) {
        attempt.heldEvent = event ?? attempt.heldEvent;
      } else if (event) {
        onErrorRef.current?.(event);
      }
      return;
    }
    if (!src) {
      if (event) onErrorRef.current?.(event);
      return;
    }
    const controller = new AbortController();
    const current = { src, controller, settled: false, heldEvent: event };
    attemptRef.current = current;
    const failed = () => {
      current.settled = true;
      if (!controller.signal.aborted && current.heldEvent) {
        onErrorRef.current?.(current.heldEvent);
      }
    };
    const init: RequestInit = { signal: controller.signal };
    const credentials = credentialsFor(props.crossOrigin);
    if (credentials) init.credentials = credentials;
    fetchQoiAsPngUrl(src, init).then((url) => {
      if (!url) return failed();
      current.settled = true;
      if (controller.signal.aborted) URL.revokeObjectURL(url);
      else setConverted({ src, url });
    }, failed);
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
  const isConverted = shown !== src;

  return (
    <img
      ref={imgRef}
      src={shown}
      // A srcset would win over the converted src, picking the QOI again.
      srcSet={isConverted ? undefined : srcSet}
      sizes={isConverted ? undefined : sizes}
      onError={(event) => {
        if (isConverted) onErrorRef.current?.(event);
        else startFallback(event);
      }}
      {...props}
    />
  );
}

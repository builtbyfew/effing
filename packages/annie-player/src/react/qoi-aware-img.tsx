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
 * it fetched again (the image the browser tried: with `srcSet`, the
 * candidate it selected, else `src`); if the bytes are QOI, they're
 * converted to a PNG that takes the original's place, keeping the `<img>`'s
 * sizing, `alt` and styles (but not `srcSet` and `sizes`, which would make
 * the browser pick a QOI candidate again, so the PNG shows at the selected
 * candidate's resolution). A QOI image is therefore fetched twice (the
 * second time usually from the HTTP cache), and it needs CORS when it's
 * cross-origin. The fetch sends credentials as `crossOrigin` says.
 *
 * `onError` is called when the image can't be shown either way: it isn't
 * QOI, it can't be fetched, or it's an invalid QOI image. An image that
 * fails before hydration is still converted if it's QOI, but otherwise
 * doesn't reach `onError`, just as with a plain `<img>` under React.
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
  // What the <img> was asked to show. A new src, srcSet or sizes may
  // select another image, so it starts the fallback over.
  const sourceKey = JSON.stringify([src, srcSet, sizes]);
  // The PNG standing in for a QOI image, keyed by the source it stands in for
  const [converted, setConverted] = useState<{
    sourceKey: string;
    url: string;
  } | null>(null);
  // The fallback attempted for an image URL: how to abort it, whether it
  // has finished, and an error event held back until it has, in case the
  // conversion succeeds after all
  const attemptRef = useRef<{
    url: string;
    controller: AbortController;
    settled: boolean;
    heldEvent: ImgErrorEvent | null;
  } | null>(null);

  const startFallback = (event: ImgErrorEvent | null) => {
    // The image the browser tried: with srcSet, the candidate it selected
    // (a 2x one, say), which may not be src. currentSrc is empty if no
    // image was selected yet, so fall back to src then.
    const url = imgRef.current?.currentSrc || src;
    const attempt = attemptRef.current;
    if (attempt && attempt.url === url) {
      if (!attempt.settled) {
        attempt.heldEvent = event ?? attempt.heldEvent;
      } else if (event) {
        onErrorRef.current?.(event);
      }
      return;
    }
    if (!url) {
      if (event) onErrorRef.current?.(event);
      return;
    }
    attemptRef.current?.controller.abort();
    const controller = new AbortController();
    const current = { url, controller, settled: false, heldEvent: event };
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
    fetchQoiAsPngUrl(url, init).then((pngUrl) => {
      if (!pngUrl) return failed();
      current.settled = true;
      if (controller.signal.aborted) URL.revokeObjectURL(pngUrl);
      else setConverted({ sourceKey, url: pngUrl });
    }, failed);
  };

  useEffect(() => {
    // An image that failed before hydration fired its error event before
    // React listened for it, so check for one when the source is first
    // shown.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      startFallback(null);
    }
    return () => {
      attemptRef.current?.controller.abort();
      attemptRef.current = null;
      setConverted(null);
    };
    // Only a new source starts over; startFallback is this render's, with
    // its props.
  }, [sourceKey]);

  useEffect(() => {
    if (!converted) return;
    const { url } = converted;
    return () => URL.revokeObjectURL(url);
  }, [converted]);

  const isConverted = converted !== null && converted.sourceKey === sourceKey;
  const shown = isConverted ? converted.url : src;

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

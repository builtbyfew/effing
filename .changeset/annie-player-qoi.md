---
"@effing/annie-player": minor
---

Play annies with QOI frames, and show QOI still images

Browsers can't decode [QOI](https://qoiformat.org), so annie-player now has a decoder of its own.

- The player recognises QOI frames by their bytes and plays them, alone or mixed with PNG and JPEG frames. It keeps each QOI frame's bytes and decodes a frame when it's drawn, rather than holding every frame decoded (8 MB per 1080p frame); a 1080p frame decodes in about 1 ms for flat graphics and up to about 13 ms for photographic content in Chrome on a recent laptop. A QOI frame with an invalid header fails the load; one that fails to decode when drawn pauses playback and reports an error. PNG and JPEG frames play as before.
- `QoiAwareImg`, from `@effing/annie-player/react`, is an `<img>` that can also show QOI. It renders a plain `<img>`, so other images load exactly as before; only when the browser can't show the image does it fetch it again and, if it's QOI, swap in a PNG converted from it. A cross-origin QOI image needs CORS.
- New exports: `decodeQoi()`, `isQoi()`, `readQoiHeader()` and `QOI_MAX_PIXELS` (8192 × 8192), and the browser helpers `qoiToPngBlob()` and `fetchQoiAsPngUrl()`.
- `destroy()` stops a load that's still running and revokes the object URLs it created, instead of letting it fill the destroyed player. That happened when the React player's `src` changed during a load.

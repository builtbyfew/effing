---
"@effing/annie-player": minor
---

Play annies with QOI frames, and show QOI still images

Browsers can't decode [QOI](https://qoiformat.org), so annie-player now has a decoder of its own.

- The player recognises QOI frames by their bytes and plays them, alone or mixed with PNG and JPEG frames. It keeps each QOI frame's bytes and decodes a frame when it's drawn, rather than holding every frame decoded (8 MB per 1080p frame). On a recent laptop a 1080p frame decodes in about 1 ms for flat graphics and about 15 ms for photographic content, within a 30 fps frame; 4K photographic content (about 45 ms) and slower devices can exceed that, and playback then slows down. A QOI frame with an invalid header fails the load; one that fails to decode when drawn pauses playback and reports an error. PNG and JPEG frames play as before.
- `QoiAwareImg`, from `@effing/annie-player/react`, is an `<img>` that can also show QOI. It renders a plain `<img>`, so other images load exactly as before; only when the browser can't show the image does it fetch it again (with credentials as `crossOrigin` says) and, if it's QOI, swap in a PNG converted from it, dropping `srcSet` and `sizes`. A cross-origin QOI image needs CORS.
- New exports: `decodeQoi()`, `isQoi()`, `readQoiHeader()` and `QOI_MAX_PIXELS` (8192 × 8192), and the browser helpers `qoiToPngBlob()` and `fetchQoiAsPngUrl()`.
- The React player loads its new player when `src` or `autoPlay` changes with `autoLoad` on. Before, the new player was never loaded and the player kept showing the old one's state, stuck on "Loading..." if the change came during a load; with `autoPlay`, the new player also had no canvas to draw on. While the new annie loads, the canvas keeps the last loaded annie's width. Turning `autoLoad` on later no longer reloads a player that's loaded already.
- The React player draws the current frame whenever its canvas is resized, which clears it. So a loaded player now shows its first frame as a poster before it plays, where the canvas used to stay blank, and an `autoPlay` player's first frame no longer blinks out when the canvas takes the annie's size.
- A new `height` resizes the React player's canvas and redraws the current frame, and a new `fps` applies through the new `AnniePlayerCore.setFps()`. Neither makes a new player any more, which fetched the annie again (and, without `autoLoad`, left the player unloaded).
- An `fps` that isn't a finite number above 0 is rejected: `new AnniePlayerCore()` and `setFps()` throw a `RangeError`, where 0 or `NaN` used to freeze playback while it reported playing, and a negative one advanced a frame on every repaint. The React player shows it as the player's error instead, with no player until the `fps` is valid again.
- `destroy()` stops a load that's still running and revokes the object URLs it created, instead of letting it fill the destroyed player.

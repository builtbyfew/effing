# @effing/annie-player

## 0.47.1

### Patch Changes

- @effing/annie@0.47.1

## 0.47.0

### Patch Changes

- @effing/annie@0.47.0

## 0.46.2

### Patch Changes

- @effing/annie@0.46.2

## 0.46.1

### Patch Changes

- @effing/annie@0.46.1

## 0.46.0

### Minor Changes

- 711f9bb: Play annies with QOI frames, and show QOI still images

  Browsers can't decode [QOI](https://qoiformat.org), so annie-player now has a decoder of its own.

  - The player recognises QOI frames by their bytes and plays them, alone or mixed with PNG and JPEG frames. It keeps each QOI frame's bytes and decodes a frame when it's drawn, rather than holding every frame decoded (8 MB per 1080p frame). On a recent laptop a 1080p frame decodes in about 1 ms for flat graphics and about 15 ms for photographic content, within a 30 fps frame; 4K photographic content (about 45 ms) and slower devices can exceed that, and playback then slows down. A QOI frame with an invalid header fails the load; one that fails to decode when drawn pauses playback and reports an error. PNG and JPEG frames play as before.
  - `QoiAwareImg`, from `@effing/annie-player/react`, is an `<img>` that can also show QOI. It renders a plain `<img>`, so other images load exactly as before; only when the browser can't show the image does it fetch the image it tried again (the `srcSet` candidate it selected, else `src`; with credentials as `crossOrigin` says) and, if it's QOI, swap in a PNG converted from it. A `srcSet` candidate is replaced in place, keeping its descriptor, so the PNG gets the same density. A cross-origin QOI image needs CORS.
  - New exports: `decodeQoi()`, `isQoi()`, `readQoiHeader()` and `QOI_MAX_PIXELS` (8192 × 8192), and the browser helpers `qoiToPngBlob()` and `fetchQoiAsPngUrl()`.
  - The React player loads its new player when `src` or `autoPlay` changes with `autoLoad` on. Before, the new player was never loaded and the player kept showing the old one's state, stuck on "Loading..." if the change came during a load; with `autoPlay`, the new player also had no canvas to draw on. While the new annie loads, the canvas keeps the last loaded annie's width. Turning `autoLoad` on later no longer reloads a player that's loaded already.
  - The React player draws the current frame whenever its canvas is resized, which clears it. So a loaded player now shows its first frame as a poster before it plays, where the canvas used to stay blank, and an `autoPlay` player's first frame no longer blinks out when the canvas takes the annie's size.
  - A new `height` resizes the React player's canvas and redraws the current frame, and a new `fps` applies through the new `AnniePlayerCore.setFps()`. Neither makes a new player any more, which fetched the annie again (and, without `autoLoad`, left the player unloaded).
  - An `fps` that isn't a finite number above 0 is rejected: `new AnniePlayerCore()` and `setFps()` throw a `RangeError`, where 0 or `NaN` used to freeze playback while it reported playing, and a negative one advanced a frame on every repaint. The React player shows it as the player's error instead, with no player until the `fps` is valid again.
  - The player settles its state before it tells listeners, so one that pauses, plays or loads again from an event leaves it consistent (no second animation loop, no stale status). For `statechange` subscribers, a frame that fails to decode no longer emits a "Paused." state before the error, and a failed load emits one state change instead of two; the final states are unchanged.
  - `destroy()` stops a load that's still running and revokes the object URLs it created, instead of letting it fill the destroyed player.

### Patch Changes

- Updated dependencies [e3525d7]
  - @effing/annie@0.46.0

## 0.45.1

### Patch Changes

- @effing/annie@0.45.1

## 0.45.0

### Patch Changes

- @effing/annie@0.45.0

## 0.44.0

### Patch Changes

- @effing/annie@0.44.0

## 0.43.0

### Patch Changes

- @effing/annie@0.43.0

## 0.42.0

### Patch Changes

- @effing/annie@0.42.0

## 0.41.1

### Patch Changes

- @effing/annie@0.41.1

## 0.41.0

### Patch Changes

- @effing/annie@0.41.0

## 0.40.2

### Patch Changes

- @effing/annie@0.40.2

## 0.40.1

### Patch Changes

- @effing/annie@0.40.1

## 0.40.0

### Minor Changes

- fd0e0bd: Read animations through the canonical `annieFrames` reader from `@effing/annie` instead of a hand-rolled untar, dropping the `@andrewbranch/untar.js` dependency. The archive now streams from the response body rather than being buffered whole, frames are ordered by their actual index (name-based sorting mis-ordered unpadded names), and each frame's Blob carries its sniffed content type. The player now only accepts canonical annies: entries must be named `frame_<digits>`, and malformed or truncated archives are rejected.

### Patch Changes

- Updated dependencies [fd0e0bd]
  - @effing/annie@0.40.0

## 0.39.0

## 0.38.4

## 0.38.3

## 0.38.2

## 0.38.1

## 0.38.0

## 0.37.1

## 0.37.0

## 0.36.2

## 0.36.1

## 0.36.0

## 0.35.3

## 0.35.2

## 0.35.1

## 0.35.0

### Minor Changes

- 4602b17: Add scrubbing support to the Annie player

  Exposes a new `seek()` method and `currentFrame` field on `AnniePlayerCore`,
  plus `AnniePlayer.Scrubber` and `AnniePlayer.FrameCounter` compound
  components. The simple `<AnniePlayer />` now renders a scrubber and frame
  counter overlay at the bottom of the canvas. `play()` resumes from the
  current frame instead of restarting at frame 0; only `stop()` resets.

## 0.34.0

## 0.33.1

## 0.33.0

## 0.32.0

## 0.31.4

## 0.31.3

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.1

## 0.29.0

## 0.28.0

## 0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT

## 0.26.0

## 0.25.1

## 0.25.0

## 0.24.8

## 0.24.7

## 0.24.6

## 0.24.5

## 0.24.4

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.2

## 0.23.1

## 0.23.0

## 0.22.3

## 0.22.2

## 0.22.1

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.1

## 0.20.0

## 0.19.3

## 0.19.2

## 0.19.1

## 0.19.0

## 0.18.6

## 0.18.5

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.1

## 0.17.0

## 0.16.0

## 0.15.1

## 0.15.0

## 0.14.1

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.1

## 0.6.0

## 0.5.0

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

## 0.1.2

## 0.1.1

# @effing/ffs

## 0.2.0

### Minor Changes

- e67c47a: Add HTTP proxy for FFmpeg URL handling

  Static FFmpeg binaries can have DNS resolution issues on Alpine Linux (musl libc). This adds an HTTP proxy that routes video/audio URLs through localhost, letting Node.js handle DNS lookups instead of FFmpeg.
  - Add `HttpProxy` class with `start()`, `transformUrl()`, and `close()` methods
  - Make `createServerContext()` async to ensure proxy is ready before handling requests
  - Pass `httpProxy` to `EffieRenderer` which transforms URLs via `urlTransformer` callback

### Patch Changes

- a852902: Use "cover" mode for background scaling

  Backgrounds are now scaled to fill the frame while maintaining aspect ratio, cropping any overflow. This matches CSS `background-size: cover` behavior.

- 5865b01: Pass HTTP video/audio URLs directly to FFmpeg

  HTTP(S) video and audio sources are now passed directly to FFmpeg instead of downloading them first. This reduces memory usage and avoids unnecessary file I/O for streaming media.

- e1a56e6: Fix potential FFmpeg deadlocks by using split/fifo filters for global background

  When multiple segments use the global background, FFmpeg previously created separate filter chains from the same input, requiring it to decode the same frames multiple times. This could cause deadlocks without proper buffering.

  Now the global background is processed once with fps/scale, then split into independent streams with fifo buffers for each segment that needs it.

- Updated dependencies [e67c47a]
  - @effing/effie@0.2.0

## 0.1.2

### Patch Changes

- @effing/effie@0.1.2

## 0.1.1

### Patch Changes

- @effing/effie@0.1.1

---
"@effing/ffs": minor
---

Decode JPEG annies on several threads: FFmpeg's JPEG decoder is single-threaded, so a streamed JPEG annie is now split round-robin over up to 4 tracks of a Matroska stream (one decoder each; a decoder per 4 cores) and interleaved back in the filter graph, with the same frames and timestamps. FFmpeg waits at most 50 ms for an annie to have a frame per decoder; an annie that has fewer is split over fewer. Annies whose frames on disk differ in size or format, short complete annies, and PNG/QOI annies (whose decoders are multi-threaded already) aren't split. `FFmpegRunner` takes a `decodeTracks` option to change the limit (1 turns splitting off).

---
"@effing/ffs": minor
---

Make @effing/ffmpeg an optional dependency for @effing/ffs

- Move @effing/ffmpeg from dependencies to optionalDependencies so FFS can start without it (falls back to system `ffmpeg`)
- Lazily resolve the FFmpeg binary at render time via dynamic `await import()` instead of importing at module load
- Lazily import `EffieRenderer` in render handlers to avoid loading FFmpeg modules at startup
- Make `httpProxy` optional in `ServerContext` to support external render backends
- Remove `getFFmpegVersion()` startup log (depended on synchronous binary resolution)
- Mark @effing/ffmpeg as external in tsup config to preserve correct `import.meta.url` path resolution

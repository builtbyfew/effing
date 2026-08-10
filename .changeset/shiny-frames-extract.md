---
"@effing/ffs": patch
---

Extract animation frames with the canonical `@effing/annie` reader instead of a hand-rolled `tar-stream` pipeline. Behavior is preserved: on-disk frame filenames stay identical (so the ffmpeg `frame_%05d` input keeps matching), the per-frame image transformer still runs, and a failing transform or malformed archive still rejects the render and cleans up the temp directory. Frame entry names are now validated against the canonical `frame_<digits>` pattern before being used as filenames.

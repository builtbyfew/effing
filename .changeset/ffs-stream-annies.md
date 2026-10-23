---
"@effing/ffs": minor
---

Start FFmpeg before annies are complete: each annie is streamed into FFmpeg through a pipe as its frames come in, so FFmpeg starts once the other sources are ready and every annie has its first frame, instead of after the last frame of the slowest annie. An annie whose frames mix image formats (e.g. JPEG and PNG) now fails the render instead of dropping the frames that don't match the first.

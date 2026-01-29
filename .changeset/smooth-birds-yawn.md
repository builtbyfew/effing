---
"@effing/ffs": patch
---

Fix potential FFmpeg deadlocks by using split/fifo filters for global background

When multiple segments use the global background, FFmpeg previously created separate filter chains from the same input, requiring it to decode the same frames multiple times. This could cause deadlocks without proper buffering.

Now the global background is processed once with fps/scale, then split into independent streams with fifo buffers for each segment that needs it.

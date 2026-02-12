---
"@effing/ffs": patch
---

fix(ffs): fix segment background scaling, data-URL cover upload, and store deletion ordering

- Segment backgrounds now use `force_original_aspect_ratio=increase,crop=WxH` matching global backgrounds, preventing aspect ratio distortion
- Cover image upload handles `data:` URLs inline instead of passing them to `ffsFetch` with an undici `Agent` dispatcher
- Render job is now deleted from the transient store only after confirming it exists

---
"@effing/effie-preview": patch
---

Fix background video/image preview to use cover mode

Background videos and images in `EffieBackgroundPreviewMedia` now default to `objectFit: "cover"` to match the actual render behavior, preventing letterboxing in the preview.

---
"@effing/create": minor
---

Add video download button to the effie preview page. After a render finishes buffering, a "Download video" link appears that saves the MP4 via a blob URL. The download URL is managed inside the render reducer (`downloadUrl` on `ready`/`done` variants, cleared automatically on re-render) with a ref for `revokeObjectURL` cleanup.

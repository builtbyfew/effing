---
"@effing/ffs": patch
---

Fix render backend proxy in the `/render` endpoints:

- Upload mode with a render backend now fetches the binary video from the backend's `/render/:id/video` and uploads it locally, instead of proxying SSE to `/render/:id/progress` which would re-run the full orchestration on the backend.
- `streamRenderVideo` no longer deletes the `VideoJob` before proxying to a render backend, fixing 404s on the backend side.
- Extracted reusable `uploadRenderedVideo` helper from `renderAndUploadInternal` for sharing between local and backend render+upload flows.

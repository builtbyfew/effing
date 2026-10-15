---
"@effing/dev": patch
---

Render previews with the props the fn's schema parses `previewProps` into

The preview endpoints and the effie preview page checked `previewProps` against the `propsSchema` but then passed the fn the unparsed object, so a schema's transforms and defaults didn't apply and a preview could differ from what a signed URL, and so the final video, renders.

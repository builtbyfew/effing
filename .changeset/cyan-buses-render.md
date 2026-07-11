---
"@effing/dev": minor
---

Add `effing render <kind> <id>` — render an image, annie, or effie fn straight to a file without a running dev server. The command spins up an ephemeral dev server on a free loopback port, resolves the fn (its `previewProps` by default, or `--props`), and writes the artifact: PNG/JPEG for images, a TAR of frames for annies, or an MP4 for effies (delegating to the project-local `ffs render`, so effies need `@effing/ffs` installed). A missing `SECRET_KEY` is replaced by a throwaway key for the render, so no env setup is required.

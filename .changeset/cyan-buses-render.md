---
"@effing/dev": minor
---

Add `effing render <kind> <id>` — render an image, annie, or effie fn straight to a file without a running dev server. The command spins up an ephemeral dev server on a free loopback port, resolves the fn (its `previewProps` by default, or `--props`), and writes the artifact: PNG/JPEG for images, a TAR of frames for annies, or an MP4 for effies (delegating to the project-local `ffs render`, so effies need `@effing/ffs` installed). A missing `SECRET_KEY` is replaced by a throwaway key for the render, so no env setup is required. `effing dev` now does the same — signed URLs just don't survive a restart — leaving `effing url` and the built production server as the only places that still require a configured `SECRET_KEY`. Both `effing render` and `effing url` also accept `--resolution <label>` to pick bounds from a `dev.resolutions` preset by label, as an alternative to spelling out `--width`/`--height`.

---
"@effing/dev": patch
---

Point the manual at `ffs render` for full-composition renders

The `effing manual` now surfaces the `@effing/ffs` render CLI: the
"Inspecting from an agent" render step and the CLI commands table both show
`ffs render <effie-json-or-url> <out.mp4>` as the straightforward way to turn an
effie into an MP4 — point it at a `/preview/effie/:id.json` URL, a signed
`/effie/:segment` URL, or a saved JSON file — instead of driving the FFS HTTP
API by hand. Commands stay tailored to the detected package manager.

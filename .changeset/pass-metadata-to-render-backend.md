---
"@effing/ffs": patch
---

fix(ffs): pass metadata to render backend resolver in `streamRenderVideo`

The `renderBackendResolver` in `streamRenderVideo` was called without the `metadata` argument, so backend routing decisions that depend on metadata would fail. `VideoJob` now carries `metadata` and all call sites pass it through.

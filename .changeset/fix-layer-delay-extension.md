---
"@effing/effie": patch
"@effing/ffs": patch
---

Fix layer `delay` extending the rendered segment past `segment.duration`

When a layer had `delay > 0`, the renderer prepended a `nullsrc` to the layer stream that pushed its length to `segment.duration + delay`. ffmpeg's overlay default `eof_action=repeat` then extended the rendered output past `segment.duration`, with the background's last frame frozen during the tail. The fix trims the source to `segment.duration - delay` before the `nullsrc` prefix, so the padded layer matches the background length. The `@effing/effie` README is also updated to clarify that `delay` defers when a layer's content starts playing, while `from` is a visibility gate that lets content keep playing from `t = 0` regardless.

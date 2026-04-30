---
"@effing/effie": patch
---

Correct README and JSDoc descriptions of `from`/`until` and `delay`

The previous wording described `from`/`until` as source-time clipping and treated `delay` as separate from layer visibility. In practice (and matching FFS's renderer), all three fields are measured in segment time: `delay` shifts when the layer's content starts playing, `from` defaults to `delay` so the visibility window opens when content begins, and `until` defaults to `segment.duration`. Effect and motion `start` values are measured from when content starts (segment time `delay`), not from `t = 0`. The Runtime Constraints "NOT enforced" section is updated to match.

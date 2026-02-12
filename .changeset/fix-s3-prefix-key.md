---
"@effing/ffs": patch
---

fix(ffs): fix S3 transient store key construction

`S3TransientStore.getFullKey` now joins prefix and key with `/` instead of concatenating them directly. The prefix is also normalized to strip trailing slashes on construction.

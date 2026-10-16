---
"@effing/ffs": patch
---

Validate `ffs render --allow-local-files` compositions instead of rejecting their `file:` sources

`--allow-local-files` had no effect without `--skip-validation`, because the composition was validated against the web-only Effie schema before the flag was checked. With the flag, `ffs render` now validates against `effieDataWithFilesSchema`, which also accepts `file:` URLs for layer, background, audio and `sources` entries; the cover must still be a web URL, and everything else is checked as before.

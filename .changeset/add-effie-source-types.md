---
"@effing/effie": minor
---

Add `extractEffieSourcesWithTypes()` function

New function that extracts source URLs along with their type information (`image`, `video`, `audio`, or `animation`). Useful for handling different source types differently during processing.

- New types: `EffieSourceType`, `EffieSourceWithType`
- `extractEffieSources()` now uses this internally

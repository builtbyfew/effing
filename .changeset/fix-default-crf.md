---
"@effing/ffs": patch
---

Fix default H.264 CRF (28 → 23)

The renderer encodes with libx264 but used a constant rate factor of 28, which
is libx265's default — not libx264's. libx264's own default is 23, so videos
were being encoded with more aggressive compression (and lower quality) than
the codec's intended baseline. The CRF is now 23 to match the encoder in use.

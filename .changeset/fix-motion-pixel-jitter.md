---
"@effing/ffs": patch
---

Round motion overlay coordinates to eliminate per-frame slide jitter

Layers animated with slide motion showed ±2px positional jitter on individual
frames: the overlay filter snaps x/y down to even values for yuv420p chroma
alignment, and epsilon-level float noise in the unrounded position expression
flipped boundary-coincident values (e.g. 719.9999999 vs 720) across the
snapping boundary. Motion coordinate expressions (slide, bounce, shake) are
now wrapped in round() so positions land on exact integers before snapping.

---
"@effing/canvas": patch
---

Fix rendering of multiple layered CSS background gradients on React elements (e.g. `backgroundImage: "linear-gradient(...), linear-gradient(...)"`). The full multi-layer string was passed as-is to the gradient parser, whose greedy regex captured across both gradients and produced corrupted color stops. Now `backgroundImage` is split into individual layers using paren-depth-aware comma splitting, and each layer is rendered bottom-to-top per CSS stacking order.

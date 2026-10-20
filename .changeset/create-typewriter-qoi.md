---
"@effing/create": patch
---

Encode the starter's typewriter annie as QOI

New projects' `text-typewriter` annie now yields QOI frames instead of PNG. Its frames are text on transparency, which QOI encodes many times faster than PNG, losslessly and with alpha, at the cost of larger frames. The rendered video looks the same.

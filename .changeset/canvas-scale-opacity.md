---
"@effing/canvas": patch
---

Fix scaled elements rendering with their opacity applied twice.

An element with a `scale()` transform other than `scale(1)` renders into an
offscreen buffer with its own `opacity` already applied, and the buffer was
then drawn back with that opacity again, so `opacity: 0.5` came out at about
0.25. An element animating out of `scale(1)` also dimmed abruptly. The buffer
is now drawn back at full strength.

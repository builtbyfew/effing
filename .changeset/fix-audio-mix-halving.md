---
"@effing/ffs": patch
---

Stop halving audio when global and segment tracks are mixed

The audio mix was emitted with amix's default `normalize=1`, which scales each
input by 1/n. Because every segment always contributes a full-length audio
stream to the mix — real audio, or synthesized `anullsrc` silence for segments
without audio — both amix inputs stayed "active" for the entire timeline, so any
global audio track was consistently attenuated by 6 dB (and segment audio was
halved too whenever a global track was present). In the common case of a
background track over otherwise-silent segments, the only real audio source was
needlessly cut in half.

The mix now uses `normalize=0`, so every source plays at exactly its configured
`volume`. Since summing without normalization can exceed full scale, a
master-bus look-ahead limiter (`alimiter`, peaks limited at 0 dBFS with
auto-leveling disabled) is applied to both audio output paths to prevent
clipping; it is transparent for signal already at or below 0 dBFS.

Note: compositions that combine a global track with segment audio (or layer a
global track over silent segments) will be up to 6 dB louder than before. If you
previously raised `volume` to compensate for the attenuation, lower it so the
summed level stays at or below full scale.

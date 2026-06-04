---
"@effing/ffs": patch
---

Fix top-level audio fades being shifted by `seek`

Reset the audio stream's timestamps before applying fades. `atrim` preserves
the source PTS, so after a `seek` the stream's timestamps start at the seek
offset rather than 0. Because the fade filters anchor on PTS, the fade-out
started ~seek seconds early (leaving the back half silent) and the fade-in was
skipped entirely when `seek > fadeIn`. Moving `asetpts=PTS-STARTPTS` ahead of
the fades anchors both correctly relative to the played audio.

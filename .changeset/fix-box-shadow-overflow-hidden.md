---
"@effing/canvas": patch
---

Fix boxShadow being clipped by the element's own overflow:hidden

CSS overflow:hidden clips children, not the element's own box-shadow. The shadow
is now drawn before the overflow clip is applied, matching browser and satori
behavior.

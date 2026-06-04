---
"@effing/dev": patch
---

Prefix downloaded effie videos with the project name

The "Download video" link on the effie preview page now names the file
`<project>-<effieId>-<width>x<height>.mp4` instead of just
`<effieId>-<width>x<height>.mp4`, so renders from different projects no longer
share an indistinguishable filename. The project name is slugified
(non-alphanumeric runs collapse to `-`, with leading/trailing hyphens trimmed)
and the prefix is omitted entirely when the project name is empty.

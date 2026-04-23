---
"@effing/create": patch
---

Move image/annie/effie dimensions into the signed URL segment

Width and height were previously read from `?w=` and `?h=` query parameters,
so anyone holding a valid signed segment could request arbitrary dimensions
(e.g. 100000x100000) and exhaust server resources. The starter now bakes
width/height into the signed payload alongside `id` and `props` and rejects
any segment whose bounds aren't positive integers ≤ 8192. Previously-issued
URLs with `?w=&h=` query strings will no longer resolve — callers need to
rebuild them via `fnUrl()`.

---
"@effing/fn": patch
---

Accept Uint8Array in imageResponse and avoid redundant copy

The `imageResponse` helper now accepts `Uint8Array` instead of `Buffer`, widening
compatibility beyond Node.js. The response body is passed as the underlying
`ArrayBuffer` directly, avoiding the previous `new Uint8Array(buffer)` copy.

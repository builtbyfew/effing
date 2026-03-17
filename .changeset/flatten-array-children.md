---
"@effing/canvas": patch
---

Flatten array children instead of wrapping them in implicit div nodes

When JSX children included arrays (from `.map()`, `Array.from()`, etc.),
`buildNode` wrapped them in a synthetic `<div>` with its own yoga node, breaking
flex layout because the parent saw fewer children than expected. Arrays are now
flattened into the parent's child list, matching React/browser behavior.

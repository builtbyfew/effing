---
"@effing/dev": patch
---

Guide agents to inspect effie JSON and layer sources before full renders

The `effing manual` "Inspecting from an agent" section now lays out a
cheapest-first debugging ladder — read the effie JSON, drill into individual
layer sources (resolving `#ref`s and fetching signed/CDN source URLs directly),
and render the full MP4 only for whole-timeline questions like timing,
transitions, and audio sync. The effie section cross-references it.

---
"@effing/ffs": minor
"@effing/effie-preview": minor
---

Consolidate SSE event types to reduce stringly-typed event drift

Export `WarmupEventMap`, `RenderEventMap`, and typed sender utilities from a new `@effing/ffs/sse` entrypoint. Replace the untyped `SSEEventSender` with a generic `TypedEventSender<TMap>` so `createEventSender` and `prefixEventSender` enforce correct payloads per event name at compile time. A plain `EventSender` remains for wire boundaries like `proxyRemoteSSE`.

On the client in `@effing/effie-preview`, derive `EffieWarmupEvent` from `WarmupEventMap` via a mapped type and normalise all variants to `{ type, data }` so the client union stays in sync with the server automatically.

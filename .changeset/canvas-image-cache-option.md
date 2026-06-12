---
"@effing/canvas": minor
"@effing/dev": patch
---

Add `options.imageCache` to `renderReactElement` for persistent image caching

By default each `renderReactElement` call creates a fresh image cache, so
every `<img>` / `background-image: url(...)` source is re-fetched and
re-decoded per call — a silent performance cliff when rendering per frame.
Callers can now pass a persistent cache (`new Map()`, exported type
`ImageCache`) so each source is loaded once, on first use. Sharing one cache
across concurrent calls is safe: entries are load promises, so concurrent
renders share a single in-flight fetch. `cachedLoadImage` now also evicts
failed loads instead of caching the rejection, so a transient network error
no longer poisons a long-lived cache. The manual's "Creating Annies" section
documents the option as the simplest fix for per-frame image fetching.

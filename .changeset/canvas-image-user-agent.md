---
"@effing/canvas": minor
---

Add a userAgent option for remote image fetches

`renderReactElement` gains a `userAgent` option that sets the User-Agent header
on remote (`http`/`https`) `<img>` and `background-image: url(...)` fetches. The
public `loadImage` is now a thin wrapper that routes remote URLs through the same
global `fetch()` path as `<img>` sources — so a global dispatcher / proxy and the
new `userAgent` option are honored, and `loadImage(url)` and `<img src={url}>`
behave consistently — while non-remote sources still delegate to
`@napi-rs/canvas`'s native loader. Images that fail to load during layout are now
reported via `console.warn` when the `debug` option is enabled instead of failing
silently.

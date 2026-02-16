---
"@effing/satori": patch
---

Handle React Fragments in serde

`expandElement` now unwraps `<>...</>` (React Fragments) to their children, preventing `DataCloneError: Symbol(react.fragment) could not be cloned` when passing Fragment-containing JSX through the worker pool. `serializeElement` also gains a guard for non-string element types, producing a clear error instead of a cryptic structured-clone failure.

---
"@effing/fn": minor
---

Add createFnRuntime for explicit, instance-scoped fn runtimes

The module loader and URL builder previously lived only in module-global state
set by initFnRuntime, so a single process could hold just one fn runtime
configuration. createFnRuntime returns an FnRuntime handle that captures its
loader and builder in a closure, letting independent runtimes coexist (e.g. in
parallel tests or multi-tenant servers). The existing initFnRuntime, fnModule,
fnUrl, fnModuleIds and fnModuleExists exports are unchanged and now delegate to
a global FnRuntime under the hood.

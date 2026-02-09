---
"@effing/ffs": minor
---

Replace static backend env vars with dynamic resolver callbacks

Backend routing is now configured via `warmupBackendResolver` and
`renderBackendResolver` callbacks passed to `createServerContext`, instead of
the removed `FFS_WARMUP_BACKEND_BASE_URL`, `FFS_RENDER_BACKEND_BASE_URL`,
`FFS_WARMUP_BACKEND_API_KEY`, and `FFS_RENDER_BACKEND_API_KEY` env vars.
Resolvers receive the job's effie data (or sources) and optional metadata,
and return a `BackendConfig` or `null` to handle locally. Job creation
handlers (`createRenderJob`, `createWarmupJob`, `createWarmupAndRenderJob`)
accept an optional `metadata` parameter stored with the job and forwarded to
resolvers. `createServerContext` also accepts an explicit `httpProxy` flag
(defaults to `true` when no render resolver is set). Renamed
`FFS_JOB_METADATA_TTL_MS` to `FFS_JOB_DATA_TTL_MS` and `jobMetadataTtlMs`
to `jobDataTtlMs` on the `TransientStore` interface.

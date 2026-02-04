---
"@effing/ffs": minor
---

Add separate TTL configuration for source caching vs job metadata

- New `FFS_SOURCE_CACHE_TTL_MS` environment variable for cached sources (default: 60 minutes)
- New `FFS_JOB_METADATA_TTL_MS` environment variable for job metadata (default: 8 hours)
- Removes `FFS_TRANSIENT_STORE_TTL_MS` in favor of the two separate TTLs
- Jobs are deleted after use, so the longer job TTL only applies to orphaned jobs

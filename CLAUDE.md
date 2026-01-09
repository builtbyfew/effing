# CLAUDE.md

## Overview

Effing is a TypeScript monorepo for programmatic video creation:

- **Annie** — Streamable animation format (TAR of PNG/JPEG frames)
- **Effie** — Declarative video composition format (JSON)
- **FFS** — FFmpeg service that renders Effie compositions to MP4

## Commands

pnpm monorepo. Node.js 22+ required.

```bash
pnpm install          # Install dependencies
pnpm -w lint          # Lint all packages
pnpm -w format        # Format all files
pnpm -w typecheck     # Typecheck all packages
pnpm -w build         # Build all packages
pnpm -w test          # Run all tests
pnpm -w docs:api      # Generate API docs
```

## Testing

- Unit tests: `*.test.ts` (Vitest)
- Mocked tests: `*.mock.test.ts` — use `vi.mock()` and `vi.mocked()`
- Integration tests: `*.integration.test.ts` — run with `pnpm test:integration` in `packages/ffs`

## Standards

- Prettier formatting, ESLint, TypeScript strict mode
- No `any` types unless absolutely necessary
- `docs/api/` is auto-generated — don't edit directly

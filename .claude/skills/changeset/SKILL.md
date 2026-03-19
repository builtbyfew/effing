---
name: changeset
description: Generate a changeset file for the current changes
allowed-tools: Bash, Write, Read, Glob, Grep
argument-hint: [patch|minor|major]
---

# Generate a Changeset

You are generating a changeset file for the effing pnpm monorepo. This monorepo
has the following published packages:

- `@effing/annie` (packages/annie)
- `@effing/annie-player` (packages/annie-player)
- `@effing/canvas` (packages/canvas)
- `@effing/create` (packages/create)
- `@effing/effie` (packages/effie)
- `@effing/effie-preview` (packages/effie-preview)
- `@effing/ffmpeg` (packages/ffmpeg)
- `@effing/ffs` (packages/ffs)

- `@effing/serde` (packages/serde)
- `@effing/tween` (packages/tween)

## Current State

Git diff (staged and unstaged) against HEAD:

!`git diff HEAD`

Git status:

!`git status --short`

Existing changeset files:

!`ls .changeset/*.md 2>/dev/null | grep -v README.md || echo "(none)"`

## Instructions

### Step 1: Check for changes

If the git diff is empty and there are no staged/unstaged changes, inform the
user there are no changes to create a changeset for and stop.

### Step 2: Determine affected packages

Map the changed files to packages:

| Path prefix               | Package                 |
| ------------------------- | ----------------------- |
| `packages/annie/`         | `@effing/annie`         |
| `packages/annie-player/`  | `@effing/annie-player`  |
| `packages/canvas/`        | `@effing/canvas`        |
| `packages/create/`        | `@effing/create`        |
| `packages/effie/`         | `@effing/effie`         |
| `packages/effie-preview/` | `@effing/effie-preview` |
| `packages/ffmpeg/`        | `@effing/ffmpeg`        |
| `packages/ffs/`           | `@effing/ffs`           |

| `packages/serde/` | `@effing/serde` |
| `packages/tween/` | `@effing/tween` |
| `demos/starter/` | `@effing/create` |

Note: `demos/starter/` changes map to `@effing/create` because the starter is
the template source for the create package.

Changes to root config files, CI workflows, and infrastructure should be
attributed to the most relevant package(s) based on what they affect.

### Step 3: Determine bump type

If the user provided an explicit bump type as an argument (`$ARGUMENTS`), use
that. Otherwise, determine the appropriate bump type:

- **patch**: Bug fixes, typo corrections, dependency updates, config tweaks, CI/infra changes
- **minor**: New features, new API endpoints, significant refactoring that changes behavior
- **major**: Breaking changes to public APIs, removal of features

Each package can have a different bump type. Assign the bump type that best
matches the nature of the change to each individual package.

### Step 4: Write the changeset description

Write a concise summary following these conventions:

- Short single-line title in imperative mood, no period
- For patch changes, one line may suffice, but add more detail if it would be useful
- For minor/major changes, add a blank line followed by a paragraph explaining what changed and why
- Do NOT include conventional-commit prefixes (no `fix:`, `feat:`, etc.)

Examples:

**Patch:** `Support font fallback chain and quote multi-word family names`

**Minor:**

```
Add clipPath support to canvas renderer

The canvas renderer now processes SVG <clipPath> definitions, applying clipping
regions to child elements during rasterization.
```

### Step 5: Generate a filename

Create a descriptive kebab-case filename (3-5 words) that summarizes the change.
Examples: `font-fallback-chain.md`, `canvas-clip-path.md`,
`fix-transform-units.md`, `add-tween-easing.md`. Keep it short and scannable.
Ensure no collision with existing files in `.changeset/`.

### Step 6: Write the changeset file

Write to `.changeset/<generated-name>.md` with this exact format:

```
---
"@effing/package-a": <bump>
"@effing/package-b": <bump>
---

<description>
```

Package names MUST be in double quotes. Only include affected packages.
One blank line between closing `---` and description. End file with a single newline.

### Step 7: Confirm

Show the user the filename and full contents, and remind them they can edit
the file if the description needs adjustment.

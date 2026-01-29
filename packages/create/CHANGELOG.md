# @effing/create

## 0.2.0

## 0.1.2

### Patch Changes

- b95b803: Use `_DOT_` prefix for dotfiles to preserve underscore-prefixed files

  Previously, the runtime logic converted all underscore-prefixed files to dotfiles, which broke legitimate files like `_index.tsx` (React Router file-system routing convention). Now uses `_DOT_` prefix to distinguish renamed dotfiles from actual underscore-prefixed files.

## 0.1.1

### Patch Changes

- 9856229: Fix catalog: references not being resolved in generated package.json. The copy-template script now parses pnpm-workspace.yaml to resolve all catalog references (like zod) instead of only handling typescript. Also removes the license field from generated projects.

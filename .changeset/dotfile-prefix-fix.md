---
"@effing/create": patch
---

Use `_DOT_` prefix for dotfiles to preserve underscore-prefixed files

Previously, the runtime logic converted all underscore-prefixed files to dotfiles, which broke legitimate files like `_index.tsx` (React Router file-system routing convention). Now uses `_DOT_` prefix to distinguish renamed dotfiles from actual underscore-prefixed files.

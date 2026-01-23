# @effing/create

## 0.1.1

### Patch Changes

- 9856229: Fix catalog: references not being resolved in generated package.json. The copy-template script now parses pnpm-workspace.yaml to resolve all catalog references (like zod) instead of only handling typescript. Also removes the license field from generated projects.

---
"@effing/create": patch
---

Clean up pff preview route code

- Replace action result type guards with `intent`/`success` discriminated union
- Refactor render state tracking from `useState` to `useReducer`
- Rename variables for clarity
- Reorder form controls

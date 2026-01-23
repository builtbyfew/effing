[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / parseEffieValidationIssues

# Function: parseEffieValidationIssues()

> **parseEffieValidationIssues**(`issues`): [`EffieValidationIssue`](../type-aliases/EffieValidationIssue.md)[] \| `undefined`

Defined in: [packages/effie-preview/src/core.ts:53](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie-preview/src/core.ts#L53)

Parse an unknown value as an array of validation issues.

## Parameters

### issues

`unknown`

The issues value to parse (typically from errorBody.issues)

## Returns

[`EffieValidationIssue`](../type-aliases/EffieValidationIssue.md)[] \| `undefined`

Array of validation issues, or undefined if not a valid array

## Example

```ts
const errorBody = await response.json();
const issues = parseEffieValidationIssues(errorBody.issues);
```

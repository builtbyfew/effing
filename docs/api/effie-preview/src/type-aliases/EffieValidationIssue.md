[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieValidationIssue

# Type Alias: EffieValidationIssue

> **EffieValidationIssue** = `object`

Defined in: [packages/effie-preview/src/core.ts:34](https://github.com/builtbyfew/effing/blob/f576e12e849f0f7e7c7d90346d9460b6b0af8096/packages/effie-preview/src/core.ts#L34)

Represents a validation issue from EffieData schema validation.

## Properties

### message

> **message**: `string`

Defined in: [packages/effie-preview/src/core.ts:38](https://github.com/builtbyfew/effing/blob/f576e12e849f0f7e7c7d90346d9460b6b0af8096/packages/effie-preview/src/core.ts#L38)

Human-readable error message

***

### path

> **path**: `string`

Defined in: [packages/effie-preview/src/core.ts:36](https://github.com/builtbyfew/effing/blob/f576e12e849f0f7e7c7d90346d9460b6b0af8096/packages/effie-preview/src/core.ts#L36)

Path to the field that failed validation (e.g., "segments.0.transition.sweep")

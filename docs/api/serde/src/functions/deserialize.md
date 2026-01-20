[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / deserialize

# Function: deserialize()

> **deserialize**\<`T`\>(`segment`, `secretKey`, `options`): `Promise`\<`T`\>

Defined in: [packages/serde/src/itsdangerous.ts:117](https://github.com/builtbyfew/effing/blob/3506549da451b3dcbb26d055409c91704957393e/packages/serde/src/itsdangerous.ts#L117)

Deserialize a URL segment, verify its signature, and decompress if needed.

Throws an error if the signature is invalid.

## Type Parameters

### T

`T` = `Record`\<`string`, `unknown`\>

## Parameters

### segment

`string`

### secretKey

`string`

### options

[`DeserializeOptions`](../interfaces/DeserializeOptions.md) = `{}`

## Returns

`Promise`\<`T`\>

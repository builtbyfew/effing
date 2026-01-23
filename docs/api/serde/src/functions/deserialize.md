[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / deserialize

# Function: deserialize()

> **deserialize**\<`T`\>(`segment`, `secretKey`, `options`): `Promise`\<`T`\>

Defined in: [packages/serde/src/itsdangerous.ts:117](https://github.com/builtbyfew/effing/blob/b95b8037f746d8f2d1f3d4bcb2f1a6a9f0ee95ec/packages/serde/src/itsdangerous.ts#L117)

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

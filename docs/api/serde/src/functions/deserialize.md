[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / deserialize

# Function: deserialize()

> **deserialize**\<`T`\>(`segment`, `secretKey`, `options`): `Promise`\<`T`\>

Defined in: [packages/serde/src/itsdangerous.ts:121](https://github.com/builtbyfew/effing/blob/main/packages/serde/src/itsdangerous.ts#L121)

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

[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / serialize

# Function: serialize()

> **serialize**(`obj`, `secretKey`, `options`): `Promise`\<`string`\>

Defined in: [packages/serde/src/itsdangerous.ts:81](https://github.com/builtbyfew/effing/blob/d1e41c9d99a08f9b11cbccfdd7d9ed3d2ec8f9ae/packages/serde/src/itsdangerous.ts#L81)

Serialize an object to a URL-safe segment with optional compression and HMAC signature.

The format is compatible with Python's itsdangerous library.
- If compression saves space, the payload is prefixed with "."
- The signature is appended after a "." separator

## Parameters

### obj

`object`

### secretKey

`string`

### options

[`SerializeOptions`](../interfaces/SerializeOptions.md) = `{}`

## Returns

`Promise`\<`string`\>

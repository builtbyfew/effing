[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / serialize

# Function: serialize()

> **serialize**(`obj`, `secretKey`, `options`): `Promise`\<`string`\>

Defined in: [packages/serde/src/itsdangerous.ts:81](https://github.com/builtbyfew/effing/blob/57e26752bafe0001bb1627bb2259be5df6af5f61/packages/serde/src/itsdangerous.ts#L81)

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

[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / SerializeOptions

# Interface: SerializeOptions

Defined in: [packages/serde/src/itsdangerous.ts:71](https://github.com/builtbyfew/effing/blob/main/packages/serde/src/itsdangerous.ts#L71)

## Extended by

- [`DeserializeOptions`](DeserializeOptions.md)

## Properties

### algorithm?

> `optional` **algorithm**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:75](https://github.com/builtbyfew/effing/blob/main/packages/serde/src/itsdangerous.ts#L75)

Hash algorithm for HMAC (default: "sha1")

***

### salt?

> `optional` **salt**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:73](https://github.com/builtbyfew/effing/blob/main/packages/serde/src/itsdangerous.ts#L73)

Salt for key derivation (default: "itsdangerous")

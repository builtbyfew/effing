[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / SerializeOptions

# Interface: SerializeOptions

Defined in: [packages/serde/src/itsdangerous.ts:67](https://github.com/builtbyfew/effing/blob/2c0fdf525308a1d8085f0692124014815d18e243/packages/serde/src/itsdangerous.ts#L67)

## Extended by

- [`DeserializeOptions`](DeserializeOptions.md)

## Properties

### algorithm?

> `optional` **algorithm**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:71](https://github.com/builtbyfew/effing/blob/2c0fdf525308a1d8085f0692124014815d18e243/packages/serde/src/itsdangerous.ts#L71)

Hash algorithm for HMAC (default: "sha1")

***

### salt?

> `optional` **salt**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:69](https://github.com/builtbyfew/effing/blob/2c0fdf525308a1d8085f0692124014815d18e243/packages/serde/src/itsdangerous.ts#L69)

Salt for key derivation (default: "itsdangerous")

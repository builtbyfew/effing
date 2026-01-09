[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / SerializeOptions

# Interface: SerializeOptions

Defined in: packages/serde/src/itsdangerous.ts:67

## Extended by

- [`DeserializeOptions`](DeserializeOptions.md)

## Properties

### algorithm?

> `optional` **algorithm**: `string`

Defined in: packages/serde/src/itsdangerous.ts:71

Hash algorithm for HMAC (default: "sha1")

***

### salt?

> `optional` **salt**: `string`

Defined in: packages/serde/src/itsdangerous.ts:69

Salt for key derivation (default: "itsdangerous")

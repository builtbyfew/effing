[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / DeserializeOptions

# Interface: DeserializeOptions

Defined in: [packages/serde/src/itsdangerous.ts:107](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/serde/src/itsdangerous.ts#L107)

## Extends

- [`SerializeOptions`](SerializeOptions.md)

## Properties

### algorithm?

> `optional` **algorithm**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:71](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/serde/src/itsdangerous.ts#L71)

Hash algorithm for HMAC (default: "sha1")

#### Inherited from

[`SerializeOptions`](SerializeOptions.md).[`algorithm`](SerializeOptions.md#algorithm)

***

### convertKeysToCamel?

> `optional` **convertKeysToCamel**: `boolean`

Defined in: [packages/serde/src/itsdangerous.ts:109](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/serde/src/itsdangerous.ts#L109)

Whether to convert snake_case keys to camelCase (default: true)

***

### salt?

> `optional` **salt**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:69](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/serde/src/itsdangerous.ts#L69)

Salt for key derivation (default: "itsdangerous")

#### Inherited from

[`SerializeOptions`](SerializeOptions.md).[`salt`](SerializeOptions.md#salt)

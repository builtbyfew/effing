[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [serde/src](../README.md) / DeserializeOptions

# Interface: DeserializeOptions

Defined in: [packages/serde/src/itsdangerous.ts:107](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/serde/src/itsdangerous.ts#L107)

## Extends

- [`SerializeOptions`](SerializeOptions.md)

## Properties

### algorithm?

> `optional` **algorithm**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:71](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/serde/src/itsdangerous.ts#L71)

Hash algorithm for HMAC (default: "sha1")

#### Inherited from

[`SerializeOptions`](SerializeOptions.md).[`algorithm`](SerializeOptions.md#algorithm)

***

### convertKeysToCamel?

> `optional` **convertKeysToCamel**: `boolean`

Defined in: [packages/serde/src/itsdangerous.ts:109](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/serde/src/itsdangerous.ts#L109)

Whether to convert snake_case keys to camelCase (default: true)

***

### salt?

> `optional` **salt**: `string`

Defined in: [packages/serde/src/itsdangerous.ts:69](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/serde/src/itsdangerous.ts#L69)

Salt for key derivation (default: "itsdangerous")

#### Inherited from

[`SerializeOptions`](SerializeOptions.md).[`salt`](SerializeOptions.md#salt)

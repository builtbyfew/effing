[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / loadLottie

# Function: loadLottie()

> **loadLottie**(`data`, `options?`): `LottieAnimation`

Defined in: [packages/canvas/src/lottie.ts:18](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/lottie.ts#L18)

Load a Lottie animation from a JSON string or Buffer.

## Parameters

### data

Lottie JSON string or Buffer

`string` | `Buffer`\<`ArrayBufferLike`\>

### options?

Optional resource path for external assets

#### resourcePath?

`string`

## Returns

`LottieAnimation`

A `LottieAnimation` handle ready for rendering

## Example

```ts
const anim = loadLottie(fs.readFileSync("animation.json", "utf-8"));
```

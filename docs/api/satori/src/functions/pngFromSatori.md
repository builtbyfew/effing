[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [satori/src](../README.md) / pngFromSatori

# Function: pngFromSatori()

> **pngFromSatori**(`template`, `options`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/satori/src/index.ts:108](https://github.com/builtbyfew/effing/blob/b95b8037f746d8f2d1f3d4bcb2f1a6a9f0ee95ec/packages/satori/src/index.ts#L108)

Render a React/JSX template to a PNG buffer using Satori

## Parameters

### template

`ReactNode`

React element to render

### options

[`PngFromSatoriOptions`](../type-aliases/PngFromSatoriOptions.md)

Rendering options

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

PNG image as a Buffer

## Example

```tsx
const png = await pngFromSatori(
  <div style={{ fontSize: 48, color: "white" }}>Hello World</div>,
  { width: 1080, height: 1080, fonts: [myFont] }
);
```

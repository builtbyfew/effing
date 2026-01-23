[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieBuffer

# Function: annieBuffer()

> **annieBuffer**(`frames`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/annie/src/generate.ts:130](https://github.com/builtbyfew/effing/blob/ba28b98e4b8d1cee14453ddc43bc0c37de0f8355/packages/annie/src/generate.ts#L130)

Collect all frames into a single annie Buffer (TAR archive)

## Parameters

### frames

`AsyncIterable`\<`Buffer`\<`ArrayBufferLike`\>\>

Async iterator yielding PNG or JPEG frame buffers

## Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Complete annie as a Buffer

## Example

```ts
const frames = renderAnnieFrames(annieId, props, { width, height });
const annie = await annieBuffer(frames);
await fs.writeFile("animation.tar", annie);
```

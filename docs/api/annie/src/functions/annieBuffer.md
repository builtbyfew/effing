[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieBuffer

# Function: annieBuffer()

> **annieBuffer**(`frames`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/annie/src/generate.ts:130](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/annie/src/generate.ts#L130)

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

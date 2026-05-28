[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / LoadImageOptions

# Interface: LoadImageOptions

Defined in: [packages/canvas/src/image.ts:8](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/image.ts#L8)

Options for [loadImage](../functions/loadImage.md).

## Properties

### userAgent?

> `optional` **userAgent**: `string`

Defined in: [packages/canvas/src/image.ts:16](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/image.ts#L16)

User-Agent header sent on remote (http/https) fetches. Matches the
`userAgent` option of `renderReactElement`, so `loadImage(url)` and an
`<img src={url}>` behave identically. An empty string is sent as an
explicit empty header; values with CR/LF cause fetch to throw `TypeError`.
Ignored for non-remote sources (paths, Buffers, data URIs).

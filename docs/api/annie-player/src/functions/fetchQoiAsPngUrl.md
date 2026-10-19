[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / fetchQoiAsPngUrl

# Function: fetchQoiAsPngUrl()

> **fetchQoiAsPngUrl**(`url`, `init?`): `Promise`\<`string` \| `null`\>

Defined in: [annie-player/src/qoi-image.ts:58](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/qoi-image.ts#L58)

Fetch an image and, if it's QOI, convert it to PNG and return an object
URL for it. Revoke the URL with `URL.revokeObjectURL()` once it's no
longer shown.

QOI is detected from the bytes, not the URL or the content type. Fetching
a cross-origin image needs CORS, unlike showing it in an `<img>`.

## Parameters

### url

`string`

The image URL

### init?

`RequestInit`

Options for `fetch()`, such as an abort `signal`

## Returns

`Promise`\<`string` \| `null`\>

An object URL for the PNG, or `null` if the image isn't QOI

## Throws

Error if the fetch fails or the QOI image is invalid

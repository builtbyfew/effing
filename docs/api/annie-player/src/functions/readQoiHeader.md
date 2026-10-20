[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / readQoiHeader

# Function: readQoiHeader()

> **readQoiHeader**(`bytes`): [`QoiHeader`](../type-aliases/QoiHeader.md)

Defined in: [annie-player/src/qoi.ts:67](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/qoi.ts#L67)

Read and validate a QOI header without decoding any pixels.

Besides the fields themselves, this checks that the data is long enough to
hold the image at all (one byte encodes at most 62 pixels), so a corrupt
header can't make a decoder allocate far more than the data could describe.

## Parameters

### bytes

`Uint8Array`

## Returns

[`QoiHeader`](../type-aliases/QoiHeader.md)

## Throws

Error if the header is missing or malformed, describes an image
  larger than [QOI\_MAX\_PIXELS](../variables/QOI_MAX_PIXELS.md), or the data is too short for it

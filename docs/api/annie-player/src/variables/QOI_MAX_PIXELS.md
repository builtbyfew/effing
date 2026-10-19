[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / QOI\_MAX\_PIXELS

# Variable: QOI\_MAX\_PIXELS

> `const` **QOI\_MAX\_PIXELS**: `number`

Defined in: [annie-player/src/qoi.ts:36](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/qoi.ts#L36)

The largest image, in pixels, that [decodeQoi](../functions/decodeQoi.md) accepts: 8192 × 8192,
or 256 MiB of RGBA output.

The reference implementation allows 400 million pixels (1.6 GB of RGBA),
more than a browser can show: decoded pixels are drawn through a canvas,
and browsers cap a canvas's area (Chrome at 268 million pixels, Safari on
iOS at 16.7 million). 8192² covers 8K UHD (7680 × 4320) with room to spare
while keeping the largest allocation a header can ask for to 256 MiB.

---
"@effing/ffs": patch
---

Upload covers with the Content-Type of their format

With `upload.coverUrl`, FFS uploaded every cover as `image/png`, whatever its format. It now sniffs the cover's bytes and uploads PNG, JPEG and QOI covers as `image/png`, `image/jpeg` and `image/qoi`. For other formats it uses the image type the cover's source declared (a data URL's media type or the response's `Content-Type`), or `application/octet-stream` if there is none. If you presign `coverUrl` with a fixed `Content-Type`, it must now match the cover's format.

Covers are usually shown in browsers, which can't display QOI, so make covers PNG or JPEG.

---
"@effing/ffs": patch
---

Upload covers with the Content-Type of their format

With `upload.coverUrl`, FFS uploaded every cover as `image/png`, whatever its format. It now sniffs the cover's bytes and uploads PNG, JPEG and QOI covers as `image/png`, `image/jpeg` and `image/qoi`. For other formats it uses the image type the cover's source declared (a data URL's media type or the response's `Content-Type`), or `application/octet-stream` if there is none.

If you presign `coverUrl` with a fixed `Content-Type` that doesn't match the cover's actual format, the upload now fails. A URL presigned for `image/png` with a JPEG cover, for example, used to succeed and store a mislabelled object, and is now rejected by the storage service because the signed and sent `Content-Type` differ. Presign `coverUrl` without a fixed `Content-Type`, or with the cover's real one.

Covers are usually shown in browsers, which can't display QOI, so make covers PNG or JPEG.

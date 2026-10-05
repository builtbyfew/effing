---
"@effing/canvas": patch
---

Draw as emoji images only the graphemes Unicode presents as emoji

- Flags such as 🇧🇪 are drawn as images; they used to be laid out as text.
- A ZWJ between letters (`a‍b`, or the joiner in Arabic and Indic text) no
  longer turns the letter before it into an emoji box, so the text shapes as
  it should.
- Symbols that are text by default, such as `©`, `✓`, `●` and `☎`, stay text
  unless U+FE0F follows them, as in browsers.
- Keycaps and `©️` load their images in the `openmoji`, `blobmoji` and `noto`
  styles, ZWJ sequences and keycaps in `fluent` and `fluentFlat`, and emoji
  typed without their U+FE0F (`🏳‍🌈`) in every style.

---
"@effing/canvas": patch
---

Detect emoji by grapheme, so flags are drawn and ZWJ text shapes

- Flags such as 🇧🇪 are drawn as images; they used to be laid out as text.
- A ZWJ between letters (`a‍b`, or the joiner in Arabic and Indic text) no
  longer turns the letter before it into an emoji box, so the text shapes as
  it should.
- Symbols with no emoji form, such as `✓` and `●`, are text. So are `©`, `®`
  and `™` unless U+FE0F follows them, and digits, `#` and `*` unless a keycap
  follows them, as browsers draw them. Every other emoji character is drawn
  as an image, with or without U+FE0F (`❤`, `☎`, `🕵`); browsers draw
  text-default ones in the BMP such as `❤` as monochrome text through system
  font fallback, which canvas lacks.
- Keycaps and `©️` load their images in the `openmoji`, `blobmoji` and `noto`
  styles, ZWJ sequences and keycaps in `fluent` and `fluentFlat`, and emoji
  typed without their U+FE0F (`🏳‍🌈`) in every style.

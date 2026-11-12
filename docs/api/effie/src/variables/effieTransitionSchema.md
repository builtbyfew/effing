[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieTransitionSchema

# Variable: effieTransitionSchema

> `const` **effieTransitionSchema**: `ZodUnion`\<readonly \[`ZodObject`\<\{ `duration`: `ZodNumber`; `easing`: `ZodOptional`\<`ZodEnum`\<\{ `ease-in`: `"ease-in"`; `ease-out`: `"ease-out"`; `linear`: `"linear"`; \}\>\>; `type`: `ZodLiteral`\<`"fade"`\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `through`: `ZodEnum`\<\{ `black`: `"black"`; `grays`: `"grays"`; `white`: `"white"`; \}\>; `type`: `ZodLiteral`\<`"fade"`\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `mode`: `ZodOptional`\<`ZodEnum`\<\{ `close`: `"close"`; `open`: `"open"`; \}\>\>; `orientation`: `ZodOptional`\<`ZodEnum`\<\{ `horizontal`: `"horizontal"`; `vertical`: `"vertical"`; \}\>\>; `type`: `ZodLiteral`\<`"barn"`\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `mode`: `ZodOptional`\<`ZodEnum`\<\{ `close`: `"close"`; `crop`: `"crop"`; `open`: `"open"`; \}\>\>; `type`: `ZodLiteral`\<`"circle"`\>; \}, `$strict`\>, `ZodObject`\<\{ `direction`: `ZodOptional`\<`ZodEnum`\<\{ `down`: `"down"`; `left`: `"left"`; `right`: `"right"`; `up`: `"up"`; \}\>\>; `duration`: `ZodNumber`; `type`: `ZodEnum`\<\{ `slice`: `"slice"`; `slide`: `"slide"`; `smooth`: `"smooth"`; `wipe`: `"wipe"`; \}\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `type`: `ZodLiteral`\<`"zoom"`\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `type`: `ZodEnum`\<\{ `dissolve`: `"dissolve"`; `pixelize`: `"pixelize"`; `radial`: `"radial"`; \}\>; \}, `$strict`\>\]\>

Defined in: [effie/src/schema.ts:72](https://github.com/builtbyfew/effing/blob/main/packages/effie/src/schema.ts#L72)

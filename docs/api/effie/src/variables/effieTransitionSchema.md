[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieTransitionSchema

# Variable: effieTransitionSchema

> `const` **effieTransitionSchema**: `ZodUnion`\<\[`ZodObject`\<\{ `duration`: `ZodNumber`; `easing`: `ZodOptional`\<`ZodEnum`\<\[`"linear"`, `"ease-in"`, `"ease-out"`\]\>\>; `type`: `ZodLiteral`\<`"fade"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `easing?`: `"ease-in"` \| `"ease-out"` \| `"linear"`; `type`: `"fade"`; \}, \{ `duration`: `number`; `easing?`: `"ease-in"` \| `"ease-out"` \| `"linear"`; `type`: `"fade"`; \}\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `through`: `ZodEnum`\<\[`"black"`, `"white"`, `"grays"`\]\>; `type`: `ZodLiteral`\<`"fade"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `through`: `"black"` \| `"white"` \| `"grays"`; `type`: `"fade"`; \}, \{ `duration`: `number`; `through`: `"black"` \| `"white"` \| `"grays"`; `type`: `"fade"`; \}\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `mode`: `ZodOptional`\<`ZodEnum`\<\[`"open"`, `"close"`\]\>\>; `orientation`: `ZodOptional`\<`ZodEnum`\<\[`"horizontal"`, `"vertical"`\]\>\>; `type`: `ZodLiteral`\<`"barn"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `mode?`: `"open"` \| `"close"`; `orientation?`: `"horizontal"` \| `"vertical"`; `type`: `"barn"`; \}, \{ `duration`: `number`; `mode?`: `"open"` \| `"close"`; `orientation?`: `"horizontal"` \| `"vertical"`; `type`: `"barn"`; \}\>\]\>

Defined in: [packages/effie/src/schema.ts:55](https://github.com/builtbyfew/effing/blob/42532851c09d29544ea83bfca09fe5633b7b7130/packages/effie/src/schema.ts#L55)

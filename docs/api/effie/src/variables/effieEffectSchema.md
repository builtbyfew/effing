[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieEffectSchema

# Variable: effieEffectSchema

> `const` **effieEffectSchema**: `ZodUnion`\<\[`ZodObject`\<\{ `duration`: `ZodNumber`; `start`: `ZodNumber`; `type`: `ZodLiteral`\<`"fade-in"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `start`: `number`; `type`: `"fade-in"`; \}, \{ `duration`: `number`; `start`: `number`; `type`: `"fade-in"`; \}\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `start`: `ZodNumber`; `type`: `ZodLiteral`\<`"fade-out"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `start`: `number`; `type`: `"fade-out"`; \}, \{ `duration`: `number`; `start`: `number`; `type`: `"fade-out"`; \}\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `start`: `ZodNumber`; `type`: `ZodLiteral`\<`"saturate-in"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `start`: `number`; `type`: `"saturate-in"`; \}, \{ `duration`: `number`; `start`: `number`; `type`: `"saturate-in"`; \}\>, `ZodObject`\<\{ `duration`: `ZodNumber`; `start`: `ZodNumber`; `type`: `ZodLiteral`\<`"saturate-out"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration`: `number`; `start`: `number`; `type`: `"saturate-out"`; \}, \{ `duration`: `number`; `start`: `number`; `type`: `"saturate-out"`; \}\>, `ZodObject`\<\{ `direction`: `ZodEnum`\<\[`"left"`, `"right"`, `"up"`, `"down"`\]\>; `distance`: `ZodNumber`; `duration`: `ZodNumber`; `type`: `ZodLiteral`\<`"scroll"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `direction`: `"left"` \| `"right"` \| `"up"` \| `"down"`; `distance`: `number`; `duration`: `number`; `type`: `"scroll"`; \}, \{ `direction`: `"left"` \| `"right"` \| `"up"` \| `"down"`; `distance`: `number`; `duration`: `number`; `type`: `"scroll"`; \}\>\]\>

Defined in: [packages/effie/src/schema.ts:100](https://github.com/builtbyfew/effing/blob/61399b1bef948e96fc2088ddfc84536ac4eb196a/packages/effie/src/schema.ts#L100)

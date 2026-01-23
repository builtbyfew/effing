[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieMotionSchema

# Variable: effieMotionSchema

> `const` **effieMotionSchema**: `ZodUnion`\<\[`ZodObject`\<\{ `amplitude`: `ZodOptional`\<`ZodNumber`\>; `duration`: `ZodOptional`\<`ZodNumber`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"bounce"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `amplitude?`: `number`; `duration?`: `number`; `start?`: `number`; `type`: `"bounce"`; \}, \{ `amplitude?`: `number`; `duration?`: `number`; `start?`: `number`; `type`: `"bounce"`; \}\>, `ZodObject`\<\{ `duration`: `ZodOptional`\<`ZodNumber`\>; `frequency`: `ZodOptional`\<`ZodNumber`\>; `intensity`: `ZodOptional`\<`ZodNumber`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"shake"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `duration?`: `number`; `frequency?`: `number`; `intensity?`: `number`; `start?`: `number`; `type`: `"shake"`; \}, \{ `duration?`: `number`; `frequency?`: `number`; `intensity?`: `number`; `start?`: `number`; `type`: `"shake"`; \}\>, `ZodObject`\<\{ `direction`: `ZodEnum`\<\[`"left"`, `"right"`, `"up"`, `"down"`\]\>; `distance`: `ZodOptional`\<`ZodNumber`\>; `duration`: `ZodOptional`\<`ZodNumber`\>; `easing`: `ZodOptional`\<`ZodEnum`\<\[`"linear"`, `"ease-in"`, `"ease-out"`, `"ease-in-out"`\]\>\>; `reverse`: `ZodOptional`\<`ZodBoolean`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"slide"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `direction`: `"left"` \| `"right"` \| `"up"` \| `"down"`; `distance?`: `number`; `duration?`: `number`; `easing?`: `"ease-in"` \| `"ease-in-out"` \| `"ease-out"` \| `"linear"`; `reverse?`: `boolean`; `start?`: `number`; `type`: `"slide"`; \}, \{ `direction`: `"left"` \| `"right"` \| `"up"` \| `"down"`; `distance?`: `number`; `duration?`: `number`; `easing?`: `"ease-in"` \| `"ease-in-out"` \| `"ease-out"` \| `"linear"`; `reverse?`: `boolean`; `start?`: `number`; `type`: `"slide"`; \}\>\]\>

Defined in: [packages/effie/src/schema.ts:130](https://github.com/builtbyfew/effing/blob/2c0fdf525308a1d8085f0692124014815d18e243/packages/effie/src/schema.ts#L130)

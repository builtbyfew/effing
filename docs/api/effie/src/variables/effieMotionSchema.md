[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieMotionSchema

# Variable: effieMotionSchema

> `const` **effieMotionSchema**: `ZodUnion`\<readonly \[`ZodObject`\<\{ `amplitude`: `ZodOptional`\<`ZodNumber`\>; `duration`: `ZodOptional`\<`ZodNumber`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"bounce"`\>; \}, `$strict`\>, `ZodObject`\<\{ `duration`: `ZodOptional`\<`ZodNumber`\>; `frequency`: `ZodOptional`\<`ZodNumber`\>; `intensity`: `ZodOptional`\<`ZodNumber`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"shake"`\>; \}, `$strict`\>, `ZodObject`\<\{ `direction`: `ZodEnum`\<\{ `down`: `"down"`; `left`: `"left"`; `right`: `"right"`; `up`: `"up"`; \}\>; `distance`: `ZodOptional`\<`ZodNumber`\>; `duration`: `ZodOptional`\<`ZodNumber`\>; `easing`: `ZodOptional`\<`ZodEnum`\<\{ `ease-in`: `"ease-in"`; `ease-in-out`: `"ease-in-out"`; `ease-out`: `"ease-out"`; `linear`: `"linear"`; \}\>\>; `reverse`: `ZodOptional`\<`ZodBoolean`\>; `start`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodLiteral`\<`"slide"`\>; \}, `$strict`\>\]\>

Defined in: [effie/src/schema.ts:147](https://github.com/builtbyfew/effing/blob/main/packages/effie/src/schema.ts#L147)

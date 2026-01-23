[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / createEffieBackgroundSchema

# Function: createEffieBackgroundSchema()

> **createEffieBackgroundSchema**\<`U`\>(`urlSchema`): `ZodUnion`\<\[`ZodObject`\<\{ `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `type`: `ZodLiteral`\<`"image"`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "type" \| "source"\]: addQuestionMarks\<baseObjectOutputType\<\{ source: ZodUnion\<\[ZodType\<(...), (...), (...)\>, ZodType\<(...), (...), (...)\>\]\>; type: ZodLiteral\<"image"\> \}\>, any\>\[k\] \}, \{ \[k in "type" \| "source"\]: baseObjectInputType\<\{ source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{(...)\}\`, ZodTypeDef, \`#$\{(...)\}\`\>\]\>; type: ZodLiteral\<"image"\> \}\>\[k\] \}\>, `ZodObject`\<\{ `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `type`: `ZodLiteral`\<`"video"`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "type" \| "source" \| "seek"\]: addQuestionMarks\<baseObjectOutputType\<\{ seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<(...), (...), (...)\>, ZodType\<(...), (...), (...)\>\]\>; type: ZodLiteral\<"video"\> \}\>, any\>\[k\] \}, \{ \[k in "type" \| "source" \| "seek"\]: baseObjectInputType\<\{ seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{(...)\}\`, ZodTypeDef, \`#$\{(...)\}\`\>\]\>; type: ZodLiteral\<"video"\> \}\>\[k\] \}\>, `ZodObject`\<\{ `color`: `ZodString`; `type`: `ZodLiteral`\<`"color"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `color`: `string`; `type`: `"color"`; \}, \{ `color`: `string`; `type`: `"color"`; \}\>\]\>

Defined in: [packages/effie/src/schema.ts:172](https://github.com/builtbyfew/effing/blob/fb541bfcbc0f706f97f2533a591a5a6943855559/packages/effie/src/schema.ts#L172)

## Type Parameters

### U

`U` *extends* `string`

## Parameters

### urlSchema

`ZodType`\<`U`\>

## Returns

`ZodUnion`\<\[`ZodObject`\<\{ `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `type`: `ZodLiteral`\<`"image"`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "type" \| "source"\]: addQuestionMarks\<baseObjectOutputType\<\{ source: ZodUnion\<\[ZodType\<(...), (...), (...)\>, ZodType\<(...), (...), (...)\>\]\>; type: ZodLiteral\<"image"\> \}\>, any\>\[k\] \}, \{ \[k in "type" \| "source"\]: baseObjectInputType\<\{ source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{(...)\}\`, ZodTypeDef, \`#$\{(...)\}\`\>\]\>; type: ZodLiteral\<"image"\> \}\>\[k\] \}\>, `ZodObject`\<\{ `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `type`: `ZodLiteral`\<`"video"`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "type" \| "source" \| "seek"\]: addQuestionMarks\<baseObjectOutputType\<\{ seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<(...), (...), (...)\>, ZodType\<(...), (...), (...)\>\]\>; type: ZodLiteral\<"video"\> \}\>, any\>\[k\] \}, \{ \[k in "type" \| "source" \| "seek"\]: baseObjectInputType\<\{ seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{(...)\}\`, ZodTypeDef, \`#$\{(...)\}\`\>\]\>; type: ZodLiteral\<"video"\> \}\>\[k\] \}\>, `ZodObject`\<\{ `color`: `ZodString`; `type`: `ZodLiteral`\<`"color"`\>; \}, `"strict"`, `ZodTypeAny`, \{ `color`: `string`; `type`: `"color"`; \}, \{ `color`: `string`; `type`: `"color"`; \}\>\]\>

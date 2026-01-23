[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / createEffieAudioSchema

# Function: createEffieAudioSchema()

> **createEffieAudioSchema**\<`U`\>(`urlSchema`): `ZodObject`\<\{ `fadeIn`: `ZodOptional`\<`ZodNumber`\>; `fadeOut`: `ZodOptional`\<`ZodNumber`\>; `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `volume`: `ZodOptional`\<`ZodNumber`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: addQuestionMarks\<baseObjectOutputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>, any\>\[k\] \}, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: baseObjectInputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>\[k\] \}\>

Defined in: [packages/effie/src/schema.ts:194](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie/src/schema.ts#L194)

## Type Parameters

### U

`U` *extends* `string`

## Parameters

### urlSchema

`ZodType`\<`U`\>

## Returns

`ZodObject`\<\{ `fadeIn`: `ZodOptional`\<`ZodNumber`\>; `fadeOut`: `ZodOptional`\<`ZodNumber`\>; `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `volume`: `ZodOptional`\<`ZodNumber`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: addQuestionMarks\<baseObjectOutputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>, any\>\[k\] \}, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: baseObjectInputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>\[k\] \}\>

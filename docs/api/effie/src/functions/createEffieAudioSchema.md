[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / createEffieAudioSchema

# Function: createEffieAudioSchema()

> **createEffieAudioSchema**\<`U`\>(`urlSchema`): `ZodObject`\<\{ `fadeIn`: `ZodOptional`\<`ZodNumber`\>; `fadeOut`: `ZodOptional`\<`ZodNumber`\>; `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `volume`: `ZodOptional`\<`ZodNumber`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: addQuestionMarks\<baseObjectOutputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>, any\>\[k\] \}, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: baseObjectInputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>\[k\] \}\>

Defined in: [packages/effie/src/schema.ts:194](https://github.com/builtbyfew/effing/blob/b46122bc8e003db755cd7f9a9ac0b2b2179d2bdf/packages/effie/src/schema.ts#L194)

## Type Parameters

### U

`U` *extends* `string`

## Parameters

### urlSchema

`ZodType`\<`U`\>

## Returns

`ZodObject`\<\{ `fadeIn`: `ZodOptional`\<`ZodNumber`\>; `fadeOut`: `ZodOptional`\<`ZodNumber`\>; `seek`: `ZodOptional`\<`ZodNumber`\>; `source`: `ZodUnion`\<\[`ZodType`\<`U`, `ZodTypeDef`, `U`\>, `ZodType`\<`` `#${string}` ``, `ZodTypeDef`, `` `#${string}` ``\>\]\>; `volume`: `ZodOptional`\<`ZodNumber`\>; \}, `"strict"`, `ZodTypeAny`, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: addQuestionMarks\<baseObjectOutputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>, any\>\[k\] \}, \{ \[k in "source" \| "seek" \| "volume" \| "fadeIn" \| "fadeOut"\]: baseObjectInputType\<\{ fadeIn: ZodOptional\<ZodNumber\>; fadeOut: ZodOptional\<ZodNumber\>; seek: ZodOptional\<ZodNumber\>; source: ZodUnion\<\[ZodType\<U, ZodTypeDef, U\>, ZodType\<\`#$\{string\}\`, ZodTypeDef, \`#$\{string\}\`\>\]\>; volume: ZodOptional\<ZodNumber\> \}\>\[k\] \}\>

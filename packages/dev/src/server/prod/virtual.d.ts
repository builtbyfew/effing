// Ambient declaration for the virtual fns map. Generated at `effing build`
// time by the esbuild plugin in `cli/build.ts` — it emits `import * as <n>
// from "<abs>"` for each user fn file and assembles them into this map.
//
// Lives in its own .d.ts (no top-level imports/exports) so `declare module`
// is treated as an ambient declaration rather than module augmentation.

declare module "virtual:effing/fns" {
  export const modulesByKind: {
    [K in import("@effing/fn").FnKind]: Record<
      string,
      import("@effing/fn").FnModule<K>
    >;
  };
}

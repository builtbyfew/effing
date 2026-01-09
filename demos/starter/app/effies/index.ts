import invariant from "tiny-invariant";
import type { z } from "zod";
import type { EffieData, EffieSources } from "@effing/effie";

/**
 * Arguments passed to effie renderer functions
 */
export type EffieRendererArgs<PropsType> = {
  props: PropsType;
  width: number;
  height: number;
};

type EffieModule = {
  propsSchema: z.ZodSchema<unknown>;
  previewProps: object;
  renderer: (
    args: EffieRendererArgs<unknown>,
  ) => Promise<EffieData<EffieSources>>;
};

// Dynamically load all effie modules
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./*.effie.tsx")).map(([key, value]) => {
    const id = key.split("/").slice(-1)[0].replace(".effie.tsx", "");
    return [id, value];
  }),
);

export type EffieId = string;

export function isEffieId(effieId: string): effieId is EffieId {
  return effieId in modules;
}

export function getEffieIds(): string[] {
  return Object.keys(modules);
}

export async function getEffie(effieId: string): Promise<EffieModule> {
  invariant(isEffieId(effieId), `no effie found for effieId '${effieId}'`);
  const module = (await modules[effieId]()) as EffieModule;
  return {
    renderer: module.renderer,
    previewProps: module.previewProps,
    propsSchema: module.propsSchema,
  };
}

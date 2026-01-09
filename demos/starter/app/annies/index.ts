import invariant from "tiny-invariant";
import type { z } from "zod";

/**
 * Arguments passed to annie renderer functions
 */
export type AnnieRendererArgs<PropsType> = {
  props: PropsType;
  width: number;
  height: number;
};

type AnnieModule = {
  propsSchema: z.ZodSchema<unknown>;
  previewProps: object;
  renderer: (args: AnnieRendererArgs<unknown>) => AsyncGenerator<Buffer>;
};

// Dynamically load all annie modules
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./*.annie.tsx")).map(([key, value]) => {
    const id = key.split("/").slice(-1)[0].replace(".annie.tsx", "");
    return [id, value];
  }),
);

export type AnnieId = string;

export function isAnnieId(annieId: string): annieId is AnnieId {
  return annieId in modules;
}

export function getAnnieIds(): string[] {
  return Object.keys(modules);
}

export async function getAnnie(annieId: string): Promise<AnnieModule> {
  invariant(isAnnieId(annieId), `no annie found for annieId '${annieId}'`);
  const module = (await modules[annieId]()) as AnnieModule;
  return {
    renderer: module.renderer,
    previewProps: module.previewProps,
    propsSchema: module.propsSchema,
  };
}

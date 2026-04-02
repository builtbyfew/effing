import type { z } from "zod";
import type { EffieData, EffieSources, EffieWebUrl } from "@effing/effie";

export type Bounds = Readonly<{ width: number; height: number }>;

export type RunnerArgs<P> = {
  props: P;
  bounds: Bounds;
};

export type FnKind = "image" | "annie" | "effie";

type BaseFnModule = {
  propsSchema: z.ZodSchema<unknown>;
  previewProps: object;
};

export type ImageRunnerReturn = Promise<Buffer>;
export type AnnieRunnerReturn = AsyncIterable<Buffer>;
export type EffieRunnerReturn<S extends EffieSources = EffieSources> = Promise<
  EffieData<S>
>;

export type ImageFnModule = BaseFnModule & {
  runner: (args: RunnerArgs<unknown>) => ImageRunnerReturn;
};

export type AnnieFnModule = BaseFnModule & {
  runner: (args: RunnerArgs<unknown>) => AnnieRunnerReturn;
};

export type EffieFnModule = BaseFnModule & {
  runner: (args: RunnerArgs<unknown>) => EffieRunnerReturn;
};

export type FnModule<K extends FnKind> = K extends "image"
  ? ImageFnModule
  : K extends "annie"
    ? AnnieFnModule
    : EffieFnModule;

export type FnModuleLoader = {
  loadModule<K extends FnKind>(kind: K, id: string): Promise<FnModule<K>>;
  listModules(kind: FnKind): string[];
  hasModule(kind: FnKind, id: string): boolean;
};

export type FnUrlBuilder = {
  buildUrl<P extends Record<string, unknown>>(
    kind: FnKind,
    id: string,
    props: P,
    bounds: Bounds,
  ): Promise<EffieWebUrl>;
};

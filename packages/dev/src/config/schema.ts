import { z } from "zod";

const globSchema = z.union([z.string(), z.array(z.string())]);

export const resolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  label: z.string(),
});

export type Resolution = z.infer<typeof resolutionSchema>;

export const devOptionsSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  ffs: z.boolean().optional(),
});

export type DevOptions = z.infer<typeof devOptionsSchema>;

export const effingConfigSchema = z.object({
  project: z.string().min(1),
  images: globSchema.optional(),
  annies: globSchema.optional(),
  effies: globSchema.optional(),
  resolutions: z.array(resolutionSchema).nonempty().optional(),
  dev: devOptionsSchema.optional(),
});

export type EffingConfig = z.infer<typeof effingConfigSchema>;

export const DEFAULT_RESOLUTIONS: Resolution[] = [
  { width: 1080, height: 1080, label: "1:1" },
  { width: 1080, height: 1350, label: "4:5" },
  { width: 1080, height: 1920, label: "9:16" },
];

export const DEFAULT_DEV: Required<Pick<DevOptions, "host" | "port" | "ffs">> =
  {
    host: "127.0.0.1",
    // 3839 = 0xEFF
    port: 3839,
    ffs: true,
  };

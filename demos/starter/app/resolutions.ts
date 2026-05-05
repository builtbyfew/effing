export type Resolution = {
  width: number;
  height: number;
  label: string;
};

// The first entry is used as the default bounds when no `?w=`/`?h=` is given.
export const RESOLUTIONS: readonly Resolution[] = [
  { width: 1080, height: 1080, label: "1:1" },
  { width: 1080, height: 1350, label: "4:5" },
  { width: 1080, height: 1920, label: "9:16" },
];

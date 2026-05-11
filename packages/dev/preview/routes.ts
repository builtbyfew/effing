import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";

// More specific patterns (with file-extension suffixes) must come before
// generic preview routes — RR matches in declaration order and `:param`
// captures non-greedy but still match dots.
const routes: RouteConfigEntry[] = [
  { id: "index", index: true, file: "routes/index.tsx" },

  // Raw artifact endpoints (must come before HTML preview routes)
  {
    id: "preview.image.bytes",
    path: "preview/image/:imageId.bytes",
    file: "routes/preview.image.bytes.tsx",
  },
  {
    id: "preview.annie.tar",
    path: "preview/annie/:annieId.tar",
    file: "routes/preview.annie.tar.tsx",
  },
  {
    id: "preview.effie.json",
    path: "preview/effie/:effieId.json",
    file: "routes/preview.effie.json.tsx",
  },

  // HTML preview pages
  {
    id: "preview.image",
    path: "preview/image/:imageId",
    file: "routes/preview.image.tsx",
  },
  {
    id: "preview.annie",
    path: "preview/annie/:annieId",
    file: "routes/preview.annie.tsx",
  },
  {
    id: "preview.effie",
    path: "preview/effie/:effieId",
    file: "routes/preview.effie.tsx",
  },

  // Signed-segment endpoints (no React)
  {
    id: "image.segment",
    path: "image/:segment",
    file: "routes/image.segment.tsx",
  },
  {
    id: "annie.segment",
    path: "annie/:segment",
    file: "routes/annie.segment.tsx",
  },
  {
    id: "effie.segment",
    path: "effie/:segment",
    file: "routes/effie.segment.tsx",
  },

  // FFS proxy endpoints (POST) — keep FFS_API_KEY server-side
  {
    id: "api.ffs.render",
    path: "api/ffs/render",
    file: "routes/api.ffs.render.tsx",
  },
  {
    id: "api.ffs.purge",
    path: "api/ffs/purge",
    file: "routes/api.ffs.purge.tsx",
  },
];

export default routes satisfies RouteConfig;

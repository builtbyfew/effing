import type { SvgChild, SvgDefs } from "./types.ts";
import { normalizeChildren } from "./tree.ts";

/**
 * Collect `<clipPath>`, `<mask>`, `<filter>`, and gradient definitions from
 * `<defs>` elements as well as direct children of `<svg>` (both are valid per
 * the SVG spec).
 */
export function collectDefs(children: SvgChild[], vbW = 0, vbH = 0): SvgDefs {
  const clips = new Map<string, SvgChild[]>();
  const gradients = new Map<string, SvgChild>();
  const masks = new Map<string, SvgChild[]>();
  const filters = new Map<string, SvgChild>();

  function insertDef(def: SvgChild): void {
    if (!def || typeof def !== "object" || !("props" in def) || !def.props)
      return;
    const id = def.props.id as string | undefined;
    if (!id) return;
    if (def.type === "clipPath") clips.set(id, normalizeChildren(def));
    else if (def.type === "mask") masks.set(id, normalizeChildren(def));
    else if (def.type === "filter") filters.set(id, def);
    else if (def.type === "radialGradient" || def.type === "linearGradient")
      gradients.set(id, def);
  }

  for (const child of children) {
    if (child.type === "defs") {
      for (const def of normalizeChildren(child)) insertDef(def);
    } else {
      // Definition elements can appear as direct children of <svg>.
      insertDef(child);
    }
  }
  return {
    clips,
    gradients,
    masks,
    filters,
    viewport: { width: vbW, height: vbH },
  };
}

export const EMPTY_DEFS: SvgDefs = {
  clips: new Map(),
  gradients: new Map(),
  masks: new Map(),
  filters: new Map(),
  viewport: { width: 0, height: 0 },
};

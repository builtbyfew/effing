import type { FixtureModule } from "../fixture.ts";
import br from "./br.tsx";
import minContent from "./min-content.tsx";
import nativeText from "./native-text.tsx";
import painting from "./painting.tsx";
import whiteSpace from "./white-space.tsx";

/** Every module of Chrome fixtures, each with a JSON file of references. */
export const modules: FixtureModule[] = [
  minContent,
  nativeText,
  whiteSpace,
  br,
  painting,
];

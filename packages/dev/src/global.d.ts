import type { FnModuleLoader } from "@effing/fn";
import type { Resolution } from "./config/schema";

declare global {
  var __effingDevFnModuleLoader: FnModuleLoader | undefined;
  var __effingDevResolutions: Resolution[] | undefined;
}

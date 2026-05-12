import { loadConfig } from "../config/load";
import {
  buildManualContext,
  detectPackageManager,
  renderManual,
} from "../manual";

export type ManualOptions = {
  config?: string;
};

export async function runManual(options: ManualOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { config, configDir } = await loadConfig(cwd, options.config);
  const pm = detectPackageManager(configDir);
  const ctx = buildManualContext(config, pm, configDir);
  process.stdout.write(renderManual(ctx));
}

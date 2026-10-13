import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { isProviderPlatformEnabled } from "../platform-credentials.js";

export function isModelRuntimeAvailable(
  model: Pick<ModelConfigItem, "provider" | "isByokEnabled" | "isPlatformEnabled">,
  env: Record<string, unknown>,
): boolean {
  if (["workers", "workers-ai"].includes(model.provider)) {
    return Boolean(env.AI);
  }

  if (model.isPlatformEnabled !== undefined || model.isByokEnabled !== undefined) {
    return model.isPlatformEnabled === true || model.isByokEnabled === true;
  }

  return isProviderPlatformEnabled(model.provider, env);
}

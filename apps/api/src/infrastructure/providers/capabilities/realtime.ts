import type { RealtimeProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getRealtimeProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): RealtimeProvider {
  return providerLibrary.resolve("realtime", providerName, context ?? {});
}

export function listRealtimeProviders(): string[] {
  return providerLibrary.listNames("realtime", { includeAliases: true });
}

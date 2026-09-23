import type { DecisionProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getDecisionProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): DecisionProvider {
  return providerLibrary.resolve("decision", providerName, context ?? {});
}

export function listConfigurableDecisionProviders(): string[] {
  return providerLibrary.list("decision").map((provider) => provider.name);
}

export function getDecisionProviderVendor(providerId: string): string | undefined {
  return providerLibrary
    .list("decision")
    .find((provider) => provider.name === providerId || provider.aliases?.includes(providerId))
    ?.metadata?.vendor;
}

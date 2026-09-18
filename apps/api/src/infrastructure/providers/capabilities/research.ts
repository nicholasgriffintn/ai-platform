import type { ResearchProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getResearchProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): ResearchProvider {
  return providerLibrary.resolve("research", providerName, context ?? {});
}

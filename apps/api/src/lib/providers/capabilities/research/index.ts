import type { ResearchProvider, ResearchProviderName } from "~/types";

import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export type {
  ResearchProvider,
  ResearchProviderName,
  ResearchOptions,
  ResearchResult,
  ResearchResultError,
  ResearchTaskHandle,
} from "~/types";
export * from "./providers";

/**
 * Resolve a research provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getResearchProvider(
  providerName: ResearchProviderName,
  context?: ProviderFactoryContext,
): ResearchProvider {
  return providerLibrary.research(providerName, context);
}

import type { SearchProvider, SearchProviderName } from "~/types";

import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export type { SearchProvider, SearchOptions, SearchProviderName, SearchResult } from "~/types";
export * from "./providers";

/**
 * Resolve a search provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getSearchProvider(
  providerName: SearchProviderName,
  context?: ProviderFactoryContext,
): SearchProvider {
  return providerLibrary.search(providerName, context);
}

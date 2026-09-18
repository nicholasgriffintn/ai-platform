import type { SearchProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getSearchProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): SearchProvider {
  return providerLibrary.resolve("search", providerName, context ?? {});
}

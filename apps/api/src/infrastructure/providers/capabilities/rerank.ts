import type { RerankProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getRerankProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): RerankProvider {
  return providerLibrary.resolve("rerank", providerName, context ?? {});
}

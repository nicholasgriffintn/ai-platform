import type { BatchProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getBatchProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): BatchProvider {
  return providerLibrary.resolve("batch", providerName, context ?? {});
}

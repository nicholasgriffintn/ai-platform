import type { SpeechProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getSpeechProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): SpeechProvider {
  return providerLibrary.resolve("speech", providerName, context ?? {});
}

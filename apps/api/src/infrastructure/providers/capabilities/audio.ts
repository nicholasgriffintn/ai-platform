import type { AudioProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getAudioProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): AudioProvider {
  return providerLibrary.resolve("audio", providerName, context ?? {});
}

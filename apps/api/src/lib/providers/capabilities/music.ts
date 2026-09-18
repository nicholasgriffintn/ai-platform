import type { MusicProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getMusicProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): MusicProvider {
  return providerLibrary.resolve("music", providerName, context ?? {});
}

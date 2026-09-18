import type { VideoProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getVideoProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): VideoProvider {
  return providerLibrary.resolve("video", providerName, context ?? {});
}

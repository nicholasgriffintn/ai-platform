import type { TranscriptionProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getTranscriptionProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): TranscriptionProvider {
  return providerLibrary.resolve("transcription", providerName, context ?? {});
}

import type { ImageProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export function getImageProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): ImageProvider {
  return providerLibrary.resolve("image", providerName, context ?? {});
}

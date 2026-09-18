import type { ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";

import { providerHost } from "./host";
import { providerLibrary } from "./library";

export const providerRuntime: ProviderRuntime = {
  host: providerHost,
  providers: providerLibrary,
};

import type { BrowserProvider } from "@ngriffin_uk/polychat-schemas";

import { OpenAIAgentsClient } from "~/infrastructure/providers/agents/OpenAIAgentsClient";

import { OpenAIAgentsBrowserProvider } from "./OpenAIAgentsBrowserProvider";
import type { BrowserSessionProvider } from "./types";

const BROWSER_PROVIDERS: Record<BrowserProvider, (apiKey: string) => BrowserSessionProvider> = {
  openai: (apiKey) => new OpenAIAgentsBrowserProvider(new OpenAIAgentsClient(apiKey)),
};

export function getBrowserSessionProvider(
  provider: BrowserProvider,
  apiKey: string,
): BrowserSessionProvider {
  return BROWSER_PROVIDERS[provider](apiKey);
}

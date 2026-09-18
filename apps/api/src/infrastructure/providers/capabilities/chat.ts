import type { AIProvider } from "@ngriffin_uk/polychat-ai-providers";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

const SYSTEM_CHAT_PROVIDERS = new Set([
  "ollama",
  "lmstudio",
  "workers",
  "workers-ai",
  "google",
  "googleai",
  "github",
]);

export function getChatProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): AIProvider {
  return providerLibrary.resolve("chat", providerName, context ?? {});
}

export function listChatProviders(): string[] {
  return providerLibrary.listNames("chat", { includeAliases: true });
}

export function listConfigurableChatProviders(): string[] {
  return providerLibrary
    .list("chat")
    .map((provider) => provider.name)
    .filter((provider) => !SYSTEM_CHAT_PROVIDERS.has(provider));
}

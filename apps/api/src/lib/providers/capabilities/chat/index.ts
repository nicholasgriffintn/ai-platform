import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import type { AIProvider } from "./providers/base";

export type { AIProvider } from "./providers/base";
export { BaseProvider } from "./providers/base";
export type { ChatCompletionParameters } from "~/types";

/**
 * Get a chat provider instance from the provider library
 * @param providerName - The name of the provider to resolve
 * @param context - Optional context for provider resolution (env, user, config, options)
 * @returns The chat provider instance
 */
export function getChatProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): AIProvider {
	try {
		return providerLibrary.chat(providerName, context);
	} catch {
		return providerLibrary.chat("workers", context);
	}
}

/**
 * List all available chat providers
 * @returns Array of provider names (including aliases)
 */
export function listChatProviders(): string[] {
	const summaries = providerLibrary.list("chat");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}

/**
 * List configurable chat providers (excludes system providers)
 * @returns Array of configurable provider names
 */
export function listConfigurableChatProviders(): string[] {
	const ignoredProviders = [
		"ollama",
		"workers",
		"workers-ai",
		"google",
		"googleai",
		"github",
	];
	return providerLibrary
		.list("chat")
		.map((provider) => provider.name)
		.filter((provider) => !ignoredProviders.includes(provider));
}

import { providerLibrary } from "./library";
import type { ProviderMetadata } from "./registry/types";
import type { AIProvider } from "./capabilities/chat/providers/base";

export interface ProviderConfig {
	key: string;
	provider: AIProvider;
	aliases?: string[];
	metadata?: ProviderMetadata;
}

export class AIProviderFactory {
	static getProviders(): string[] {
		const summaries = providerLibrary.list("chat");
		const names = new Set<string>();

		for (const summary of summaries) {
			names.add(summary.name);
			summary.aliases?.forEach((alias) => names.add(alias));
		}

		return Array.from(names).sort();
	}

	static getConfigurableProviders(): string[] {
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

	static getProvider(providerName: string): AIProvider {
		try {
			return providerLibrary.chat(providerName);
		} catch {
			return providerLibrary.chat("workers");
		}
	}

	static registerProvider(config: ProviderConfig): void {
		providerLibrary.register("chat", {
			name: config.key,
			aliases: config.aliases,
			lifecycle: "singleton",
			metadata: config.metadata,
			create: () => config.provider,
		});
	}
}

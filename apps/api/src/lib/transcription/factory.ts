import type { TranscriptionProvider } from "./base";
import { MistralTranscriptionProvider } from "./mistral";
import { ReplicateTranscriptionProvider } from "./replicate";
import { WorkersTranscriptionProvider } from "./workers";

export class TranscriptionProviderFactory {
	private static providers: Record<string, TranscriptionProvider> = {
		workers: new WorkersTranscriptionProvider(),
		mistral: new MistralTranscriptionProvider(),
		replicate: new ReplicateTranscriptionProvider(),
	};

	static getProvider(providerName: string): TranscriptionProvider {
		return (
			TranscriptionProviderFactory.providers[providerName] ||
			TranscriptionProviderFactory.providers.workers
		);
	}

	static getProviders(): string[] {
		return Object.keys(TranscriptionProviderFactory.providers);
	}
}

import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { TranscriptionProvider } from "../../capabilities/transcription";
import {
	WorkersTranscriptionProvider,
	MistralTranscriptionProvider,
	ReplicateTranscriptionProvider,
} from "../../capabilities/transcription/providers";

const transcriptionProviders: ProviderRegistration<TranscriptionProvider>[] = [
	{
		name: "workers",
		create: () => new WorkersTranscriptionProvider(),
		metadata: { vendor: "Cloudflare", categories: ["transcription"] },
	},
	{
		name: "mistral",
		create: () => new MistralTranscriptionProvider(),
		metadata: { vendor: "Mistral", categories: ["transcription"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateTranscriptionProvider(),
		metadata: { vendor: "Replicate", categories: ["transcription"] },
	},
];

export function registerTranscriptionProviders(
	registry: ProviderRegistry,
): void {
	for (const registration of transcriptionProviders) {
		registry.register("transcription", registration);
	}
}

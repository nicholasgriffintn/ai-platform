import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { SpeechProvider } from "../../capabilities/speech";
import {
	ReplicateSpeechProvider,
	WorkersAiSpeechProvider,
} from "../../capabilities/speech/providers";

const speechProviders: ProviderRegistration<SpeechProvider>[] = [
	{
		name: "workers-ai",
		aliases: ["workers"],
		create: () => new WorkersAiSpeechProvider(),
		metadata: { vendor: "Cloudflare", categories: ["speech"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateSpeechProvider(),
		metadata: { vendor: "Replicate", categories: ["speech"] },
	},
];

export function registerSpeechProviders(registry: ProviderRegistry): void {
	for (const registration of speechProviders) {
		registry.register("speech", registration);
	}
}

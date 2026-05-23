import type { RealtimeProvider } from "../../capabilities/realtime";
import { OpenAIRealtimeProvider } from "../../capabilities/realtime/providers";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";

const realtimeProviders: ProviderRegistration<RealtimeProvider>[] = [
	{
		name: "openai",
		aliases: ["gpt"],
		create: () => new OpenAIRealtimeProvider(),
		metadata: { vendor: "OpenAI", categories: ["realtime"], tags: ["transcription"] },
	},
];

export function registerRealtimeProviders(registry: ProviderRegistry): void {
	for (const registration of realtimeProviders) {
		registry.register("realtime", registration);
	}
}

import type { RealtimeProvider } from "../../capabilities/realtime";
import {
	CartesiaRealtimeProvider,
	ElevenLabsRealtimeProvider,
	GoogleRealtimeProvider,
	MistralRealtimeProvider,
	OpenAIRealtimeProvider,
} from "../../capabilities/realtime/providers";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";

const realtimeProviders: ProviderRegistration<RealtimeProvider>[] = [
	{
		name: "openai",
		aliases: ["gpt"],
		create: () => new OpenAIRealtimeProvider(),
		metadata: { vendor: "OpenAI", categories: ["realtime"], tags: ["webrtc", "voice"] },
	},
	{
		name: "google-ai-studio",
		aliases: ["google", "googleai"],
		create: () => new GoogleRealtimeProvider(),
		metadata: { vendor: "Google", categories: ["realtime"], tags: ["live-api", "voice", "vision"] },
	},
	{
		name: "mistral",
		aliases: ["voxtral"],
		create: () => new MistralRealtimeProvider(),
		metadata: { vendor: "Mistral", categories: ["realtime"], tags: ["transcription"] },
	},
	{
		name: "elevenlabs",
		aliases: ["scribe"],
		create: () => new ElevenLabsRealtimeProvider(),
		metadata: { vendor: "ElevenLabs", categories: ["realtime"], tags: ["transcription"] },
	},
	{
		name: "cartesia",
		aliases: ["ink"],
		create: () => new CartesiaRealtimeProvider(),
		metadata: { vendor: "Cartesia", categories: ["realtime"], tags: ["transcription"] },
	},
];

export function registerRealtimeProviders(registry: ProviderRegistry): void {
	for (const registration of realtimeProviders) {
		registry.register("realtime", registration);
	}
}

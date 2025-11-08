import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { AudioProvider } from "../../capabilities/audio";
import {
	CartesiaAudioProvider,
	ElevenLabsAudioProvider,
	MelottsAudioProvider,
	PollyAudioProvider,
} from "../../capabilities/audio/providers";

const audioProviders: ProviderRegistration<AudioProvider>[] = [
	{
		name: "elevenlabs",
		create: () => new ElevenLabsAudioProvider(),
		metadata: { vendor: "ElevenLabs", categories: ["audio"], tags: ["tts"] },
	},
	{
		name: "polly",
		create: () => new PollyAudioProvider(),
		metadata: { vendor: "AWS", categories: ["audio"], tags: ["tts"] },
	},
	{
		name: "cartesia",
		aliases: ["certesia"],
		create: () => new CartesiaAudioProvider(),
		metadata: { vendor: "Cartesia", categories: ["audio"], tags: ["tts"] },
	},
	{
		name: "melotts",
		create: () => new MelottsAudioProvider(),
		metadata: {
			vendor: "Cloudflare",
			categories: ["audio"],
			tags: ["tts", "workers-ai"],
		},
	},
];

export function registerAudioProviders(registry: ProviderRegistry): void {
	for (const registration of audioProviders) {
		registry.register("audio", registration);
	}
}

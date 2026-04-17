import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { MusicProvider } from "../../capabilities/music";
import {
	ElevenLabsMusicProvider,
	ReplicateMusicProvider,
	WorkersAiMusicProvider,
} from "../../capabilities/music/providers";

const musicProviders: ProviderRegistration<MusicProvider>[] = [
	{
		name: "workers-ai",
		aliases: ["workers"],
		create: () => new WorkersAiMusicProvider(),
		metadata: { vendor: "Cloudflare", categories: ["music"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateMusicProvider(),
		metadata: { vendor: "Replicate", categories: ["music"] },
	},
	{
		name: "elevenlabs",
		create: () => new ElevenLabsMusicProvider(),
		metadata: { vendor: "ElevenLabs", categories: ["music"] },
	},
];

export function registerMusicProviders(registry: ProviderRegistry): void {
	for (const registration of musicProviders) {
		registry.register("music", registration);
	}
}

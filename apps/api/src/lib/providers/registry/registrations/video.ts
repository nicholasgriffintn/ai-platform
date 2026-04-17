import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { VideoProvider } from "../../capabilities/video";
import {
	ReplicateVideoProvider,
	WorkersAiVideoProvider,
} from "../../capabilities/video/providers";

const videoProviders: ProviderRegistration<VideoProvider>[] = [
	{
		name: "workers-ai",
		aliases: ["workers"],
		create: () => new WorkersAiVideoProvider(),
		metadata: { vendor: "Cloudflare", categories: ["video"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateVideoProvider(),
		metadata: { vendor: "Replicate", categories: ["video"] },
	},
];

export function registerVideoProviders(registry: ProviderRegistry): void {
	for (const registration of videoProviders) {
		registry.register("video", registration);
	}
}

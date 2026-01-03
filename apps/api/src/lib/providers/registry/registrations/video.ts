import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { VideoProvider } from "../../capabilities/video";
import { ReplicateVideoProvider } from "../../capabilities/video/providers";

const videoProviders: ProviderRegistration<VideoProvider>[] = [
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

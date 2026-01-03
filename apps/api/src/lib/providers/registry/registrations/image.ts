import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { ImageProvider } from "../../capabilities/image";
import {
	ReplicateImageProvider,
	WorkersAiImageProvider,
} from "../../capabilities/image/providers";

const imageProviders: ProviderRegistration<ImageProvider>[] = [
	{
		name: "workers-ai",
		aliases: ["workers"],
		create: () => new WorkersAiImageProvider(),
		metadata: { vendor: "Cloudflare", categories: ["image"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateImageProvider(),
		metadata: { vendor: "Replicate", categories: ["image"] },
	},
];

export function registerImageProviders(registry: ProviderRegistry): void {
	for (const registration of imageProviders) {
		registry.register("image", registration);
	}
}

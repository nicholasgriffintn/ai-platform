import type { ImageProvider } from "../capabilities/image/index.js";
import {
  ReplicateImageProvider,
  WorkersAiImageProvider,
} from "../capabilities/image/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function imageProviders(runtime: ProviderRuntime): AiProviderRegistration<ImageProvider>[] {
  return [
    {
      name: "workers-ai",
      aliases: ["workers"],
      create: () => new WorkersAiImageProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["image"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateImageProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["image"] },
    },
  ];
}

export function registerImageProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of imageProviders(runtime)) {
    registry.register("image", registration);
  }
}

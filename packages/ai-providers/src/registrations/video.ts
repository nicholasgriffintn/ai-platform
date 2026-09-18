import type { VideoProvider } from "../capabilities/video/index.js";
import {
  ReplicateVideoProvider,
  WorkersAiVideoProvider,
} from "../capabilities/video/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function videoProviders(runtime: ProviderRuntime): AiProviderRegistration<VideoProvider>[] {
  return [
    {
      name: "workers-ai",
      aliases: ["workers"],
      create: () => new WorkersAiVideoProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["video"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateVideoProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["video"] },
    },
  ];
}

export function registerVideoProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of videoProviders(runtime)) {
    registry.register("video", registration);
  }
}

import type { MusicProvider } from "../capabilities/music/index.js";
import {
  ReplicateMusicProvider,
  WorkersAiMusicProvider,
} from "../capabilities/music/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function musicProviders(runtime: ProviderRuntime): AiProviderRegistration<MusicProvider>[] {
  return [
    {
      name: "workers-ai",
      aliases: ["workers"],
      create: () => new WorkersAiMusicProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["music"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateMusicProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["music"] },
    },
  ];
}

export function registerMusicProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of musicProviders(runtime)) {
    registry.register("music", registration);
  }
}

import type { SpeechProvider } from "../capabilities/speech/index.js";
import {
  ReplicateSpeechProvider,
  WorkersAiSpeechProvider,
} from "../capabilities/speech/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function speechProviders(runtime: ProviderRuntime): AiProviderRegistration<SpeechProvider>[] {
  return [
    {
      name: "workers-ai",
      aliases: ["workers"],
      create: () => new WorkersAiSpeechProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["speech"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateSpeechProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["speech"] },
    },
  ];
}

export function registerSpeechProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of speechProviders(runtime)) {
    registry.register("speech", registration);
  }
}

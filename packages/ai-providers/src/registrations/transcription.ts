import type { TranscriptionProvider } from "../capabilities/transcription/index.js";
import {
  WorkersTranscriptionProvider,
  MistralTranscriptionProvider,
  ReplicateTranscriptionProvider,
} from "../capabilities/transcription/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function transcriptionProviders(
  runtime: ProviderRuntime,
): AiProviderRegistration<TranscriptionProvider>[] {
  return [
    {
      name: "workers",
      create: () => new WorkersTranscriptionProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["transcription"] },
    },
    {
      name: "mistral",
      create: () => new MistralTranscriptionProvider(runtime),
      metadata: { vendor: "Mistral", categories: ["transcription"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateTranscriptionProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["transcription"] },
    },
  ];
}

export function registerTranscriptionProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of transcriptionProviders(runtime)) {
    registry.register("transcription", registration);
  }
}

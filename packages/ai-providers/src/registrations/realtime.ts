import type { RealtimeProvider } from "../capabilities/realtime/index.js";
import {
  CartesiaRealtimeProvider,
  ElevenLabsRealtimeProvider,
  GoogleRealtimeProvider,
  GreenPtRealtimeProvider,
  MistralRealtimeProvider,
  OpenAIRealtimeProvider,
} from "../capabilities/realtime/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function realtimeProviders(runtime: ProviderRuntime): AiProviderRegistration<RealtimeProvider>[] {
  return [
    {
      name: "openai",
      aliases: ["gpt"],
      create: () => new OpenAIRealtimeProvider(runtime),
      metadata: { vendor: "OpenAI", categories: ["realtime"], tags: ["webrtc", "voice"] },
    },
    {
      name: "google-ai-studio",
      aliases: ["google", "googleai"],
      create: () => new GoogleRealtimeProvider(runtime),
      metadata: {
        vendor: "Google",
        categories: ["realtime"],
        tags: ["live-api", "voice", "vision"],
      },
    },
    {
      name: "mistral",
      aliases: ["voxtral"],
      create: () => new MistralRealtimeProvider(runtime),
      metadata: { vendor: "Mistral", categories: ["realtime"], tags: ["transcription"] },
    },
    {
      name: "elevenlabs",
      aliases: ["scribe"],
      create: () => new ElevenLabsRealtimeProvider(runtime),
      metadata: { vendor: "ElevenLabs", categories: ["realtime"], tags: ["transcription"] },
    },
    {
      name: "cartesia",
      aliases: ["ink"],
      create: () => new CartesiaRealtimeProvider(runtime),
      metadata: { vendor: "Cartesia", categories: ["realtime"], tags: ["transcription"] },
    },
    {
      name: "greenpt",
      create: () => new GreenPtRealtimeProvider(runtime),
      metadata: { vendor: "GreenPT", categories: ["realtime"], tags: ["transcription"] },
    },
  ];
}

export function registerRealtimeProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of realtimeProviders(runtime)) {
    registry.register("realtime", registration);
  }
}

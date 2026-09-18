import type { AudioProvider } from "../capabilities/audio/index.js";
import {
  CartesiaAudioProvider,
  ElevenLabsAudioProvider,
  MelottsAudioProvider,
  MistralAudioProvider,
  PollyAudioProvider,
} from "../capabilities/audio/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function audioProviders(runtime: ProviderRuntime): AiProviderRegistration<AudioProvider>[] {
  return [
    {
      name: "elevenlabs",
      create: () => new ElevenLabsAudioProvider(runtime),
      metadata: { vendor: "ElevenLabs", categories: ["audio"], tags: ["tts"] },
    },
    {
      name: "polly",
      create: () => new PollyAudioProvider(runtime),
      metadata: { vendor: "AWS", categories: ["audio"], tags: ["tts"] },
    },
    {
      name: "cartesia",
      aliases: ["certesia"],
      create: () => new CartesiaAudioProvider(runtime),
      metadata: { vendor: "Cartesia", categories: ["audio"], tags: ["tts"] },
    },
    {
      name: "melotts",
      create: () => new MelottsAudioProvider(runtime),
      metadata: {
        vendor: "Cloudflare",
        categories: ["audio"],
        tags: ["tts", "workers-ai"],
      },
    },
    {
      name: "mistral",
      create: () => new MistralAudioProvider(runtime),
      metadata: { vendor: "Mistral", categories: ["audio"], tags: ["tts", "voxtral"] },
    },
  ];
}

export function registerAudioProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of audioProviders(runtime)) {
    registry.register("audio", registration);
  }
}

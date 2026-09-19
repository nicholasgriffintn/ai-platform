import type { ProviderHost } from "./host.js";
import {
  ProviderLibrary,
  type ProviderBootstrappers,
  type ProviderCategoryDecorators,
  type ProviderDecorator,
  type ProviderErrorMapper,
} from "./library.js";
import { registerAudioProviders } from "./registrations/audio.js";
import { registerChatProviders } from "./registrations/chat.js";
import { registerGuardrailProviders } from "./registrations/guardrails.js";
import { registerImageProviders } from "./registrations/image.js";
import { registerMusicProviders } from "./registrations/music.js";
import { registerOcrProviders } from "./registrations/ocr.js";
import { registerRealtimeProviders } from "./registrations/realtime.js";
import { registerRerankProviders } from "./registrations/rerank.js";
import { registerResearchProviders } from "./registrations/research.js";
import { registerSearchProviders } from "./registrations/search.js";
import { registerSpeechProviders } from "./registrations/speech.js";
import { registerTranscriptionProviders } from "./registrations/transcription.js";
import { registerVideoProviders } from "./registrations/video.js";
import type {
  AiProviderMap,
  AiProviderResolver,
  ProviderFactoryContext,
  ProviderRuntime,
} from "./runtime.js";

export interface CreateProviderLibraryOptions<
  TMap extends AiProviderMap,
  TContext extends ProviderFactoryContext,
> {
  host: ProviderHost;
  bootstrappers?: ProviderBootstrappers<TMap, TContext>;
  decorate?: ProviderDecorator<TMap, TContext>;
  decorators?: ProviderCategoryDecorators<TMap, TContext>;
  mapError?: ProviderErrorMapper;
}

export function createAiProviderBootstrappers(
  runtime: ProviderRuntime,
): ProviderBootstrappers<AiProviderMap, ProviderFactoryContext> {
  return {
    audio: [(registry) => registerAudioProviders(registry, runtime)],
    chat: [(registry) => registerChatProviders(registry, runtime)],
    guardrails: [(registry) => registerGuardrailProviders(registry, runtime)],
    image: [(registry) => registerImageProviders(registry, runtime)],
    music: [(registry) => registerMusicProviders(registry, runtime)],
    ocr: [(registry) => registerOcrProviders(registry, runtime)],
    realtime: [(registry) => registerRealtimeProviders(registry, runtime)],
    rerank: [(registry) => registerRerankProviders(registry, runtime)],
    research: [(registry) => registerResearchProviders(registry, runtime)],
    search: [(registry) => registerSearchProviders(registry, runtime)],
    speech: [(registry) => registerSpeechProviders(registry, runtime)],
    transcription: [(registry) => registerTranscriptionProviders(registry, runtime)],
    video: [(registry) => registerVideoProviders(registry, runtime)],
  };
}

export function createProviderLibrary<
  TMap extends AiProviderMap,
  TContext extends ProviderFactoryContext,
>(options: CreateProviderLibraryOptions<TMap, TContext>): ProviderLibrary<TMap, TContext> {
  const runtime: ProviderRuntime = {
    host: options.host,
    get providers(): AiProviderResolver {
      return library;
    },
  };
  const library = new ProviderLibrary<TMap, TContext>({
    bootstrappers: mergeBootstrappers(
      createAiProviderBootstrappers(runtime),
      options.bootstrappers,
    ),
    decorate: options.decorate,
    decorators: options.decorators,
    mapError: options.mapError,
  });

  return library;
}

function mergeBootstrappers<TMap extends AiProviderMap, TContext extends ProviderFactoryContext>(
  base: ProviderBootstrappers<AiProviderMap, ProviderFactoryContext>,
  extra: ProviderBootstrappers<TMap, TContext> | undefined,
): ProviderBootstrappers<TMap, TContext> {
  const merged: ProviderBootstrappers<TMap, TContext> = {
    ...(base as ProviderBootstrappers<TMap, TContext>),
  };

  for (const category of Object.keys(extra ?? {}) as (keyof TMap & string)[]) {
    merged[category] = [...(merged[category] ?? []), ...(extra?.[category] ?? [])];
  }

  return merged;
}

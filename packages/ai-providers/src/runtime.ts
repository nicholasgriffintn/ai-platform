import type { AudioProvider } from "./capabilities/audio/index.js";
import type { AIProvider } from "./capabilities/chat/providers/base.js";
import type { ImageProvider } from "./capabilities/image/index.js";
import type { MusicProvider } from "./capabilities/music/index.js";
import type { OcrProvider } from "./capabilities/ocr/types.js";
import type { RealtimeProvider } from "./capabilities/realtime/index.js";
import type { SpeechProvider } from "./capabilities/speech/index.js";
import type { TranscriptionProvider } from "./capabilities/transcription/index.js";
import type { VideoProvider } from "./capabilities/video/index.js";
import type { ProviderEnv, ProviderUser } from "./env.js";
import type { ProviderHost } from "./host.js";
import type { ProviderRegistry } from "./registry.js";
import type { ProviderRegistration } from "./types.js";
import type { DecisionProvider } from "./types/decision.js";
import type { GuardrailsProvider } from "./types/guardrails.js";
import type { RerankingProvider } from "./types/reranking.js";
import type { ResearchProvider } from "./types/research.js";
import type { SearchProvider } from "./types/search.js";

export type AiProviderMap = {
  audio: AudioProvider;
  chat: AIProvider;
  decision: DecisionProvider;
  guardrails: GuardrailsProvider;
  image: ImageProvider;
  music: MusicProvider;
  ocr: OcrProvider;
  realtime: RealtimeProvider;
  research: ResearchProvider;
  reranking: RerankingProvider;
  search: SearchProvider;
  speech: SpeechProvider;
  transcription: TranscriptionProvider;
  video: VideoProvider;
};

export type AiProviderCategory = keyof AiProviderMap;

export interface ProviderFactoryContext {
  env?: ProviderEnv;
  user?: ProviderUser;
  config?: unknown;
  options?: Record<string, unknown>;
}

export interface AiProviderResolver {
  resolve<TCategory extends AiProviderCategory>(
    category: TCategory,
    providerName: string,
    context: ProviderFactoryContext,
  ): AiProviderMap[TCategory];
}

export interface ProviderRuntime {
  host: ProviderHost;
  providers: AiProviderResolver;
}

export type AiProviderRegistration<TInstance> = ProviderRegistration<
  TInstance,
  ProviderFactoryContext
>;

export type AiProviderRegistry = ProviderRegistry<AiProviderMap, ProviderFactoryContext>;

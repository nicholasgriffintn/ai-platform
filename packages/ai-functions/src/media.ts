import {
  generateWithProviderFallback,
  type AudioSynthesisRequest,
  type AudioSynthesisResult,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type MusicGenerationRequest,
  type MusicGenerationResult,
  type OcrExtractionRequest,
  type OcrExtractionResult,
  type ProviderRuntime,
  type SpeechGenerationRequest,
  type SpeechGenerationResult,
  type TranscriptionRequest,
  type TranscriptionResult,
  type VideoGenerationRequest,
  type VideoGenerationResult,
} from "@ngriffin_uk/polychat-ai-providers";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";

export interface MediaRoutingOptions {
  provider?: string;
  defaultProvider?: string;
  allowFallback?: boolean;
}

type GenerationRequest =
  | ImageGenerationRequest
  | MusicGenerationRequest
  | SpeechGenerationRequest
  | VideoGenerationRequest;

async function resolveMediaProvider(
  runtime: ProviderRuntime,
  request: Pick<GenerationRequest, "env" | "model">,
  routing: MediaRoutingOptions,
  defaultProvider: string,
): Promise<{ providerName: string; defaultProvider: string }> {
  const resolvedDefault = routing.defaultProvider ?? defaultProvider;
  const providerName = await runtime.host.models.resolveModelProvider({
    model: request.model,
    provider: routing.provider,
    defaultProvider: resolvedDefault,
    env: request.env,
  });

  return { providerName, defaultProvider: resolvedDefault };
}

export function createMediaFunctions(runtime: ProviderRuntime) {
  const route = async <TRequest extends GenerationRequest, TResult>(
    request: TRequest,
    routing: MediaRoutingOptions,
    defaultProvider: string,
    getProvider: (name: string) => { generate(input: TRequest): Promise<TResult> },
  ): Promise<TResult> => {
    const resolved = await resolveMediaProvider(runtime, request, routing, defaultProvider);

    return generateWithProviderFallback({
      providerName: resolved.providerName,
      defaultProvider: resolved.defaultProvider,
      request,
      getProvider,
      allowFallback: routing.allowFallback ?? true,
    });
  };

  const scope = (request: GenerationRequest) => ({ env: request.env, user: request.user });

  return {
    resolveMediaProvider: (
      category: "image" | "music" | "speech" | "video",
      request: Pick<GenerationRequest, "env" | "model">,
      routing: MediaRoutingOptions = {},
    ) =>
      resolveMediaProvider(runtime, request, routing, MODEL_DEFAULTS[category].workersAi.provider),
    image: (
      request: ImageGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<ImageGenerationResult> =>
      route(request, routing, MODEL_DEFAULTS.image.workersAi.provider, (name) =>
        runtime.providers.resolve("image", name, scope(request)),
      ),
    music: (
      request: MusicGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<MusicGenerationResult> =>
      route(request, routing, MODEL_DEFAULTS.music.workersAi.provider, (name) =>
        runtime.providers.resolve("music", name, scope(request)),
      ),
    speech: (
      request: SpeechGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<SpeechGenerationResult> =>
      route(request, routing, MODEL_DEFAULTS.speech.workersAi.provider, (name) =>
        runtime.providers.resolve("speech", name, scope(request)),
      ),
    video: (
      request: VideoGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<VideoGenerationResult> =>
      route(request, routing, MODEL_DEFAULTS.video.workersAi.provider, (name) =>
        runtime.providers.resolve("video", name, scope(request)),
      ),
    synthesise: (
      providerName: string,
      request: AudioSynthesisRequest,
    ): Promise<AudioSynthesisResult> =>
      runtime.providers
        .resolve("audio", providerName, { env: request.env, user: request.user })
        .synthesize(request),
    transcribe: (
      providerName: string,
      request: TranscriptionRequest,
    ): Promise<TranscriptionResult> =>
      runtime.providers
        .resolve("transcription", providerName, { env: request.env, user: request.user })
        .transcribe(request),
    ocr: async (request: OcrExtractionRequest): Promise<OcrExtractionResult> => {
      const providerName = await runtime.host.models.resolveModelProvider({
        model: request.model,
        provider: request.provider,
        defaultProvider: MODEL_DEFAULTS.ocr.provider,
        env: request.env,
      });

      return runtime.providers
        .resolve("ocr", providerName, { env: request.env, user: request.user })
        .extractText(request);
    },
  };
}

export type MediaFunctions = ReturnType<typeof createMediaFunctions>;

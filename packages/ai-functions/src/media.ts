import type {
  AudioSynthesisRequest,
  AudioSynthesisResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  MusicGenerationRequest,
  MusicGenerationResult,
  OcrExtractionRequest,
  OcrExtractionResult,
  ProviderRuntime,
  TranscriptionRequest,
  TranscriptionResult,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export interface MediaRoutingOptions {
  provider?: string;
}

type GenerationRequest = ImageGenerationRequest | MusicGenerationRequest | VideoGenerationRequest;

async function resolveMediaProvider(
  runtime: ProviderRuntime,
  request: Pick<GenerationRequest, "env" | "model">,
  routing: MediaRoutingOptions,
): Promise<{ providerName: string }> {
  if (!request.model) {
    throw new AssistantError("A model is required for media generation", ErrorType.PARAMS_ERROR);
  }

  const providerName = await runtime.host.models.resolveModelProvider({
    model: request.model,
    provider: routing.provider,
    defaultProvider: routing.provider ?? "",
    env: request.env,
  });

  return { providerName };
}

export function createMediaFunctions(runtime: ProviderRuntime) {
  const route = async <TRequest extends GenerationRequest, TResult>(
    request: TRequest,
    routing: MediaRoutingOptions,
    getProvider: (name: string) => { generate(input: TRequest): Promise<TResult> },
  ): Promise<TResult> => {
    const { providerName } = await resolveMediaProvider(runtime, request, routing);

    return getProvider(providerName).generate(request);
  };

  const scope = (request: GenerationRequest) => ({ env: request.env, user: request.user });

  return {
    resolveMediaProvider: (
      request: Pick<GenerationRequest, "env" | "model">,
      routing: MediaRoutingOptions = {},
    ) => resolveMediaProvider(runtime, request, routing),
    image: (
      request: ImageGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<ImageGenerationResult> =>
      route(request, routing, (name) => runtime.providers.resolve("image", name, scope(request))),
    music: (
      request: MusicGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<MusicGenerationResult> =>
      route(request, routing, (name) => runtime.providers.resolve("music", name, scope(request))),
    video: (
      request: VideoGenerationRequest,
      routing: MediaRoutingOptions = {},
    ): Promise<VideoGenerationResult> =>
      route(request, routing, (name) => runtime.providers.resolve("video", name, scope(request))),
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
        defaultProvider: request.provider ?? "",
        env: request.env,
      });

      return runtime.providers
        .resolve("ocr", providerName, { env: request.env, user: request.user })
        .extractText(request);
    },
  };
}

export type MediaFunctions = ReturnType<typeof createMediaFunctions>;

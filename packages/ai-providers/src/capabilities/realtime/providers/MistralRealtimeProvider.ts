import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  RealtimeProvider,
  RealtimeSessionRequest,
  RealtimeTranscriptionDelay,
} from "../index.js";
import { buildGrantedRealtimeProxyUrl } from "./proxyUrl.js";

export const MISTRAL_REALTIME_DESCRIPTOR = {
  id: "mistral",
  order: 2,
  label: "Mistral Realtime",
  shortLabel: "Mistral",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Streaming speech-to-text",
  defaultModelId: "voxtral-mini-transcribe-realtime",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

export const DEFAULT_TRANSCRIPTION_MODEL = MISTRAL_REALTIME_DESCRIPTOR.defaultModelId;
export const MISTRAL_REALTIME_MODEL_ID = "voxtral-mini-transcribe-realtime-2602";
const API_KEY_ENVIRONMENT_VARIABLE = "MISTRAL_API_KEY";
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
  realtime: [],
  translation: [],
  transcription: [DEFAULT_TRANSCRIPTION_MODEL],
};

const MISTRAL_REALTIME_PROXY_PATH = "/realtime/mistral/transcription";
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const MISTRAL_TARGET_DELAY_MS_BY_DELAY: Record<NonNullable<RealtimeTranscriptionDelay>, number> = {
  minimal: 240,
  low: 500,
  medium: 1000,
  high: 2400,
  xhigh: 5000,
};

export function getMistralTargetStreamingDelayMs(
  delay?: RealtimeTranscriptionDelay,
): number | undefined {
  return delay ? MISTRAL_TARGET_DELAY_MS_BY_DELAY[delay] : undefined;
}

export function resolveMistralRealtimeProxyModel(model?: string): string | undefined {
  const requestedModel = model ?? DEFAULT_TRANSCRIPTION_MODEL;

  if (
    requestedModel !== DEFAULT_TRANSCRIPTION_MODEL &&
    requestedModel !== MISTRAL_REALTIME_MODEL_ID
  ) {
    return undefined;
  }

  return MISTRAL_REALTIME_MODEL_ID;
}

export class MistralRealtimeProvider implements RealtimeProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "mistral";
  descriptor = MISTRAL_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: [API_KEY_ENVIRONMENT_VARIABLE],
  };
  models = SESSION_MODELS_BY_TYPE.transcription;

  private getProviderKeyName(): string {
    return API_KEY_ENVIRONMENT_VARIABLE;
  }

  async getApiKey(request: RealtimeSessionRequest): Promise<string> {
    return resolveHostProviderApiKey(this.runtime.host, {
      env: request.env,
      providerName: this.name,
      envKeyName: this.getProviderKeyName(),
      userId: request.user.id,
      credentialAuthority: request.credentialAuthority,
    });
  }

  getDefaultModel(type: RealtimeSessionRequest["type"]): string {
    if (type !== "transcription") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    return DEFAULT_TRANSCRIPTION_MODEL;
  }

  private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
    const requestedModel = request.model || this.getDefaultModel(request.type);
    const modelId = requestedModel;
    const supportedModels = SESSION_MODELS_BY_TYPE[request.type];

    if (!supportedModels.includes(requestedModel)) {
      throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
    }

    const modelConfig = await this.runtime.host.models.getModelConfigByModel(modelId, request.env);

    if (!modelConfig || modelConfig.provider !== this.name) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return modelConfig.matchingModel;
  }

  buildAudioFormat(): Record<string, unknown> {
    return {
      encoding: "pcm_s16le",
      sample_rate: 16000,
    };
  }

  getTranscriptionDelay(request: RealtimeSessionRequest): RealtimeTranscriptionDelay {
    const delay = request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;
    const TRANSCRIPTION_DELAYS = Object.keys(
      MISTRAL_TARGET_DELAY_MS_BY_DELAY,
    ) as RealtimeTranscriptionDelay[];

    if (!TRANSCRIPTION_DELAYS.includes(delay)) {
      throw new AssistantError("Invalid transcription delay specified", ErrorType.PARAMS_ERROR);
    }

    return delay;
  }

  async createSession(request: RealtimeSessionRequest): Promise<unknown> {
    if (request.type !== "transcription") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    const model = await this.resolveModel(request);

    const targetStreamingDelayMs = getMistralTargetStreamingDelayMs(
      this.getTranscriptionDelay(request),
    );
    const sessionId = generateId();
    const proxy = await buildGrantedRealtimeProxyUrl({
      host: this.runtime.host,
      apiBaseUrl: request.apiBaseUrl ?? request.env.API_BASE_URL,
      env: request.env,
      model,
      params: { delay: request.delay },
      path: MISTRAL_REALTIME_PROXY_PATH,
      provider: this.name,
      sessionId,
      userId: request.user.id,
    });

    return {
      id: sessionId,
      object: "realtime.transcription.session",
      type: "transcription",
      provider: this.name,
      transport: "websocket",
      url: proxy.url,
      proxy_grant_expires_at: proxy.expiresAt,
      audio_format: this.buildAudioFormat(),
      input_audio_format: this.buildAudioFormat().encoding,
      input_audio_transcription: {
        model,
      },
      ...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
    };
  }
}

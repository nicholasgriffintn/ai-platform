import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ProviderRuntime } from "../../../runtime.js";
import { GREENPT_API_KEY_ENV, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import type {
  RealtimeProvider,
  RealtimeSessionRequest,
  RealtimeTranscriptionDelay,
} from "../index.js";
import { buildGrantedRealtimeProxyUrl } from "./proxyUrl.js";

export const GREENPT_REALTIME_DESCRIPTOR = {
  id: "greenpt",
  order: 5,
  label: "GreenPT Realtime",
  shortLabel: "GreenPT",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Green S streaming speech-to-text",
  defaultModelId: "green-s",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

const DEFAULT_TRANSCRIPTION_MODEL = GREENPT_REALTIME_DESCRIPTOR.defaultModelId;
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
  realtime: [],
  translation: [],
  transcription: [DEFAULT_TRANSCRIPTION_MODEL, "green-s-pro"],
};
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const GREENPT_REALTIME_PROXY_PATH = "/realtime/greenpt/transcription";

export class GreenPtRealtimeProvider implements RealtimeProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "greenpt";
  descriptor = GREENPT_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: [GREENPT_API_KEY_ENV],
  };
  models = SESSION_MODELS_BY_TYPE.transcription;

  async getApiKey(request: RealtimeSessionRequest): Promise<string> {
    return resolveGreenPtApiKey(this.runtime.host, {
      env: request.env,
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

    if (!SESSION_MODELS_BY_TYPE[request.type].includes(requestedModel)) {
      throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
    }

    const modelConfig = await this.runtime.host.models.getModelConfigByModel(
      requestedModel,
      request.env,
    );

    if (!modelConfig || modelConfig.provider !== this.name) {
      throw new AssistantError(
        `Model configuration not found for ${requestedModel}`,
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
    return request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;
  }

  async createSession(request: RealtimeSessionRequest): Promise<unknown> {
    if (request.type !== "transcription") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    const model = await this.resolveModel(request);
    const sessionId = generateId();
    const proxy = await buildGrantedRealtimeProxyUrl({
      host: this.runtime.host,
      apiBaseUrl: request.apiBaseUrl ?? request.env.API_BASE_URL,
      env: request.env,
      model,
      params: {
        delay: this.getTranscriptionDelay(request),
        language: request.language,
      },
      path: GREENPT_REALTIME_PROXY_PATH,
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
        ...(request.language ? { language: request.language } : {}),
      },
    };
  }
}

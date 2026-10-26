import type {
  ModelConfigItem,
  RealtimeLiveProviderDescriptor,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  RealtimeProvider,
  RealtimeProviderConfiguration,
  RealtimeSessionRequest,
  RealtimeTranscriptionDelay,
} from "../index.js";
import { buildGrantedRealtimeProxyUrl, REALTIME_TRANSCRIPTION_PROXY_PATH } from "./proxyUrl.js";

const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const PROXY_AUDIO_FORMAT = { encoding: "pcm_s16le", sample_rate: 16000 } as const;

export abstract class TranscriptionProxyRealtimeProvider implements RealtimeProvider {
  abstract readonly name: string;
  abstract readonly descriptor: RealtimeLiveProviderDescriptor;
  abstract readonly configuration: RealtimeProviderConfiguration;
  abstract readonly models: string[];

  constructor(protected readonly runtime: ProviderRuntime) {}

  async getApiKey(request: RealtimeSessionRequest): Promise<string> {
    const envKeyName = this.configuration.environmentVariables[0];

    if (!envKeyName) {
      throw new AssistantError(
        `${this.descriptor.shortLabel} does not use an API key`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return resolveHostProviderApiKey(this.runtime.host, {
      env: request.env,
      providerName: this.name,
      envKeyName,
      userId: request.user.id,
      credentialAuthority: request.credentialAuthority,
    });
  }

  getDefaultModel(type: RealtimeSessionRequest["type"]): string {
    if (type !== "transcription") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    return this.descriptor.defaultModelId;
  }

  buildAudioFormat(): { encoding: string; sample_rate: number } {
    return { ...PROXY_AUDIO_FORMAT };
  }

  getTranscriptionDelay(request: RealtimeSessionRequest): RealtimeTranscriptionDelay {
    return request.delay ?? this.descriptor.defaultDelay ?? DEFAULT_TRANSCRIPTION_DELAY;
  }

  protected toUpstreamModel(modelConfig: ModelConfigItem): string {
    return modelConfig.matchingModel;
  }

  protected buildProxyParams(
    _request: RealtimeSessionRequest,
    delay: RealtimeTranscriptionDelay,
  ): Record<string, string | undefined> {
    return { delay };
  }

  protected buildTranscriptionMetadata(
    _request: RealtimeSessionRequest,
    model: string,
  ): Record<string, string> {
    return { model };
  }

  protected buildSessionExtras(_request: RealtimeSessionRequest): Record<string, unknown> {
    return {};
  }

  private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
    const requestedModel = request.model || this.getDefaultModel(request.type);

    if (!this.models.includes(requestedModel)) {
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

    return this.toUpstreamModel(modelConfig);
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
      byok: request.credentialAuthority === "byok",
      env: request.env,
      model,
      params: this.buildProxyParams(request, this.getTranscriptionDelay(request)),
      path: REALTIME_TRANSCRIPTION_PROXY_PATH,
      provider: this.name,
      sessionId,
      userId: request.user.id,
    });
    const audioFormat = this.buildAudioFormat();

    return {
      id: sessionId,
      object: "realtime.transcription.session",
      type: "transcription",
      provider: this.name,
      transport: "websocket",
      url: proxy.url,
      proxy_grant_expires_at: proxy.expiresAt,
      audio_format: audioFormat,
      input_audio_format: audioFormat.encoding,
      input_audio_transcription: this.buildTranscriptionMetadata(request, model),
      ...this.buildSessionExtras(request),
    };
  }
}

import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { formatProviderError } from "../../../utils/errors.js";
import type {
  RealtimeProvider,
  RealtimeSessionType,
  RealtimeSessionRequest,
  RealtimeTranscriptionDelay,
} from "../index.js";
import {
  validateRealtimeModalities,
  type RealtimeModality,
  type RealtimeTransport,
} from "../modalities.js";
import { buildGrantedRealtimeProxyUrl } from "./proxyUrl.js";

export const OPENAI_REALTIME_DESCRIPTOR = {
  id: "openai",
  order: 0,
  label: "OpenAI Realtime",
  shortLabel: "OpenAI",
  liveMode: "native",
  transport: "webrtc",
  sessionType: "realtime",
  inputModalities: ["audio"],
  outputModalities: ["audio"],
  description: "WebRTC voice agent",
  defaultModelId: "gpt-realtime-2.1",
  supportsTranscriptionSession: true,
} satisfies RealtimeLiveProviderDescriptor;

const DEFAULT_REALTIME_MODEL = OPENAI_REALTIME_DESCRIPTOR.defaultModelId;

export const OPENAI_LIVE_MODEL = "gpt-live-1";
export const OPENAI_LIVE_PROTOCOL = "openai-live";
export const OPENAI_LIVE_SESSIONS_URL = "https://api.openai.com/v1/live/sessions";
const OPENAI_LIVE_PROXY_PATH = "/realtime/openai/live/calls";
const DEFAULT_LIVE_DELEGATION_MODEL = "gpt-6-sol";
const API_KEY_ENVIRONMENT_VARIABLE = "OPENAI_API_KEY";
const DEFAULT_TRANSLATION_MODEL = "gpt-realtime-translate";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-live-transcribe";
const DEFAULT_REALTIME_INPUT_TRANSCRIPTION_MODEL = "gpt-live-transcribe";
const OPENAI_WEBRTC_CALL_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_WEBRTC_TRANSLATION_CALL_URL = "https://api.openai.com/v1/realtime/translations/calls";
const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const OPENAI_TRANSLATION_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";
const DEFAULT_MODELS_BY_TYPE = {
  realtime: DEFAULT_REALTIME_MODEL,
  translation: DEFAULT_TRANSLATION_MODEL,
  transcription: DEFAULT_TRANSCRIPTION_MODEL,
} satisfies Record<RealtimeSessionRequest["type"], string>;
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
  realtime: [DEFAULT_REALTIME_MODEL, "gpt-realtime-2.1-mini", "gpt-realtime-2", OPENAI_LIVE_MODEL],
  translation: [DEFAULT_TRANSLATION_MODEL],
  transcription: [DEFAULT_TRANSCRIPTION_MODEL, "gpt-realtime-whisper"],
};
const LANGUAGE_LIST_TRANSCRIPTION_MODELS = new Set([DEFAULT_TRANSCRIPTION_MODEL]);
const DEFAULT_LANGUAGE = "en";
const DEFAULT_VOICE = "marin";
const DEFAULT_TRANSPORT: RealtimeTransport = "webrtc";
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const TRANSCRIPTION_DELAYS = new Set<RealtimeTranscriptionDelay>([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const REALTIME_TURN_DETECTION = {
  type: "semantic_vad",
  eagerness: "auto",
  create_response: true,
  interrupt_response: true,
};

const SUPPORTED_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["text", "audio", "image"],
  translation: ["audio"],
  transcription: ["audio"],
};

const SUPPORTED_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["text", "audio"],
  translation: ["text", "audio"],
  transcription: ["text"],
};

const DEFAULT_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["text", "audio"],
  translation: ["audio"],
  transcription: ["audio"],
};

const DEFAULT_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["audio"],
  translation: ["text", "audio"],
  transcription: ["text"],
};

export function buildOpenAILiveSessionConfig({
  model,
  instructions,
  voice,
}: {
  model: string;
  instructions?: string;
  voice?: string;
}): Record<string, unknown> {
  return {
    model,
    ...(instructions ? { instructions } : {}),
    audio: { output: { voice: voice ?? DEFAULT_VOICE } },
    delegation: {
      type: "responses",
      responses: { model: DEFAULT_LIVE_DELEGATION_MODEL },
    },
  };
}

interface OpenAIRealtimeClientSecretResponse {
  value: string;
  expires_at: number;
  session?: Record<string, unknown> & {
    id?: string;
  };
}

export class OpenAIRealtimeProvider implements RealtimeProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "openai";
  descriptor = OPENAI_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: [API_KEY_ENVIRONMENT_VARIABLE],
  };
  models = [
    ...SESSION_MODELS_BY_TYPE.realtime,
    DEFAULT_TRANSLATION_MODEL,
    ...SESSION_MODELS_BY_TYPE.transcription,
  ];

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

  private async getSafetyIdentifier(request: RealtimeSessionRequest): Promise<string> {
    return sha256Hex(`user:${request.user.id}`);
  }

  getDefaultModel(type: RealtimeSessionRequest["type"]): string {
    return DEFAULT_MODELS_BY_TYPE[type];
  }

  private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
    const requestedModel = request.model || this.getDefaultModel(request.type);
    const supportedModels = SESSION_MODELS_BY_TYPE[request.type];

    if (!supportedModels.includes(requestedModel)) {
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

  private buildTranscriptionLanguage(
    model: string,
    language: string | undefined,
  ): { languages: string[] } | { language: string } {
    const resolvedLanguage = language ?? DEFAULT_LANGUAGE;

    return LANGUAGE_LIST_TRANSCRIPTION_MODELS.has(model)
      ? { languages: [resolvedLanguage] }
      : { language: resolvedLanguage };
  }

  private getTransport(request: RealtimeSessionRequest): RealtimeTransport {
    const transport = request.transport ?? DEFAULT_TRANSPORT;

    if (transport !== "webrtc") {
      throw new AssistantError("Unsupported realtime transport specified", ErrorType.PARAMS_ERROR);
    }

    return transport;
  }

  private getInputModalities(request: RealtimeSessionRequest): RealtimeModality[] {
    validateRealtimeModalities({
      requested: request.inputModalities,
      supported: SUPPORTED_INPUT_MODALITIES_BY_TYPE[request.type],
      label: "input",
    });

    return request.inputModalities ?? DEFAULT_INPUT_MODALITIES_BY_TYPE[request.type];
  }

  private getOutputModalities(request: RealtimeSessionRequest): RealtimeModality[] {
    validateRealtimeModalities({
      requested: request.outputModalities,
      supported: SUPPORTED_OUTPUT_MODALITIES_BY_TYPE[request.type],
      label: "output",
    });

    const modalities = request.outputModalities ?? DEFAULT_OUTPUT_MODALITIES_BY_TYPE[request.type];

    if (
      request.type === "realtime" &&
      modalities.includes("audio") &&
      modalities.includes("text")
    ) {
      throw new AssistantError(
        "OpenAI realtime sessions support audio or text output, not both",
        ErrorType.PARAMS_ERROR,
      );
    }

    return modalities;
  }

  buildAudioFormat(): Record<string, unknown> {
    return {
      type: "audio/pcm",
      rate: 24000,
    };
  }

  getTranscriptionDelay(request: RealtimeSessionRequest): RealtimeTranscriptionDelay {
    const delay = request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;

    if (!TRANSCRIPTION_DELAYS.has(delay)) {
      throw new AssistantError("Invalid transcription delay specified", ErrorType.PARAMS_ERROR);
    }

    return delay;
  }

  private async buildTranscriptionSessionBody(
    request: RealtimeSessionRequest,
  ): Promise<Record<string, unknown>> {
    const model = await this.resolveModel(request);

    return {
      session: {
        type: "transcription",
        audio: {
          input: {
            format: this.buildAudioFormat(),
            transcription: {
              model,
              ...this.buildTranscriptionLanguage(model, request.language),
              delay: this.getTranscriptionDelay(request),
            },
            turn_detection: null,
          },
        },
      },
    };
  }

  private async buildRealtimeSessionBody(
    request: RealtimeSessionRequest,
  ): Promise<Record<string, unknown>> {
    const model = await this.resolveModel(request);
    const outputModalities = this.getOutputModalities(request);
    const audioOutput = outputModalities.includes("audio")
      ? {
          output: {
            format: this.buildAudioFormat(),
            voice: request.voice ?? DEFAULT_VOICE,
          },
        }
      : {};

    return {
      session: {
        type: "realtime",
        model,
        output_modalities: outputModalities,
        ...(request.instructions ? { instructions: request.instructions } : {}),
        audio: {
          input: {
            format: this.buildAudioFormat(),
            transcription: {
              model: DEFAULT_REALTIME_INPUT_TRANSCRIPTION_MODEL,
              ...this.buildTranscriptionLanguage(
                DEFAULT_REALTIME_INPUT_TRANSCRIPTION_MODEL,
                request.language,
              ),
            },
            turn_detection: REALTIME_TURN_DETECTION,
          },
          ...audioOutput,
        },
      },
    };
  }

  private async buildTranslationSessionBody(
    request: RealtimeSessionRequest,
  ): Promise<Record<string, unknown>> {
    const model = await this.resolveModel(request);

    return {
      session: {
        model,
        audio: {
          output: {
            language: request.targetLanguage ?? DEFAULT_LANGUAGE,
          },
        },
      },
    };
  }

  private normalizeClientSecretResponse(
    response: OpenAIRealtimeClientSecretResponse,
    type: RealtimeSessionType,
  ) {
    const session = response.session;

    return {
      ...session,
      provider: this.name,
      transport: DEFAULT_TRANSPORT,
      url: type === "translation" ? OPENAI_WEBRTC_TRANSLATION_CALL_URL : OPENAI_WEBRTC_CALL_URL,
      client_secret: {
        value: response.value,
        expires_at: response.expires_at,
      },
    };
  }

  private async createLiveSession(
    request: RealtimeSessionRequest,
    {
      model,
      transport,
      inputModalities,
      outputModalities,
    }: {
      model: string;
      transport: RealtimeTransport;
      inputModalities: RealtimeModality[];
      outputModalities: RealtimeModality[];
    },
  ): Promise<unknown> {
    const sessionId = generateId();
    const proxy = await buildGrantedRealtimeProxyUrl({
      host: this.runtime.host,
      apiBaseUrl: request.apiBaseUrl ?? request.env.API_BASE_URL,
      byok: request.credentialAuthority === "byok",
      env: request.env,
      model,
      params: {
        instructions: request.instructions,
        voice: request.voice,
      },
      path: OPENAI_LIVE_PROXY_PATH,
      provider: this.name,
      scheme: "https",
      sessionId,
      userId: request.user.id,
    });

    return {
      id: sessionId,
      object: "realtime.session",
      type: "realtime",
      provider: this.name,
      transport,
      protocol: OPENAI_LIVE_PROTOCOL,
      model,
      url: proxy.url,
      proxy_grant_expires_at: proxy.expiresAt,
      client_secret: { value: "", expires_at: proxy.expiresAt },
      input_modalities: inputModalities,
      output_modalities: outputModalities,
      modalities: outputModalities,
      audio: {
        input: { format: this.buildAudioFormat() },
        output: { format: this.buildAudioFormat(), voice: request.voice ?? DEFAULT_VOICE },
      },
    };
  }

  async createSession(request: RealtimeSessionRequest): Promise<unknown> {
    if (
      request.type !== "realtime" &&
      request.type !== "translation" &&
      request.type !== "transcription"
    ) {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    const transport = this.getTransport(request);
    const inputModalities = this.getInputModalities(request);
    const outputModalities = this.getOutputModalities(request);

    if (request.type === "realtime") {
      const model = await this.resolveModel(request);

      if (model === OPENAI_LIVE_MODEL) {
        return this.createLiveSession(request, {
          model,
          transport,
          inputModalities,
          outputModalities,
        });
      }
    }

    const apiKey = await this.getApiKey(request);
    const body =
      request.type === "realtime"
        ? await this.buildRealtimeSessionBody(request)
        : request.type === "translation"
          ? await this.buildTranslationSessionBody(request)
          : await this.buildTranscriptionSessionBody(request);
    const endpoint =
      request.type === "translation"
        ? OPENAI_TRANSLATION_CLIENT_SECRETS_URL
        : OPENAI_CLIENT_SECRETS_URL;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": await this.getSafetyIdentifier(request),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Failed to create realtime session"),
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    const clientSecret = (await response.json()) as OpenAIRealtimeClientSecretResponse;

    return {
      ...(this.normalizeClientSecretResponse(clientSecret, request.type) as Record<
        string,
        unknown
      >),
      transport,
      input_modalities: inputModalities,
      output_modalities: outputModalities,
      modalities: outputModalities,
    };
  }
}

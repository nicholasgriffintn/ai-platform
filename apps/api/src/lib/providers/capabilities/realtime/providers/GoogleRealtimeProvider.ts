import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import { getModelConfigByModel } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { formatGoogleStudioModelResource } from "~/lib/providers/utils/googleStudio";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { RealtimeProvider, RealtimeSessionRequest, RealtimeSessionType } from "../index";
import {
  validateRealtimeModalities,
  type RealtimeModality,
  type RealtimeTransport,
} from "../modalities";

export const GOOGLE_REALTIME_DESCRIPTOR = {
  id: "google-ai-studio",
  order: 1,
  label: "Gemini Live",
  shortLabel: "Gemini",
  liveMode: "native",
  transport: "websocket",
  sessionType: "realtime",
  inputModalities: ["audio", "video"],
  outputModalities: ["audio"],
  description: "WebSocket voice and vision",
  defaultModelId: "gemini-3.1-flash-live-preview",
  supportsVideoInput: true,
} satisfies RealtimeLiveProviderDescriptor;

const DEFAULT_REALTIME_MODEL = GOOGLE_REALTIME_DESCRIPTOR.defaultModelId;
const API_KEY_ENVIRONMENT_VARIABLE = "GOOGLE_STUDIO_API_KEY";
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
  realtime: [
    DEFAULT_REALTIME_MODEL,
    "gemini-live-2.5-flash",
    "gemini-live-2.5-flash-preview-native-audio",
  ],
  translation: [],
  transcription: [],
};
const LIVE_WEBSOCKET_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const AUTH_TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
const DEFAULT_VOICE = "Kore";
const DEFAULT_TRANSPORT: RealtimeTransport = "websocket";
// Keep one token usable across multiple socket rotations while bounding exposure
// with a two-hour expiry, one use, a one-minute start window, and locked config.
const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;
const NEW_SESSION_LIFETIME_MS = 60 * 1000;

const SUPPORTED_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["text", "audio", "image", "video"],
  translation: [],
  transcription: [],
};

const SUPPORTED_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["text", "audio"],
  translation: [],
  transcription: [],
};

const DEFAULT_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["audio"],
  translation: [],
  transcription: [],
};

const DEFAULT_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
  realtime: ["audio"],
  translation: [],
  transcription: [],
};

interface GoogleAuthTokenResponse {
  name: string;
  expireTime?: string;
  newSessionExpireTime?: string;
}

export class GoogleRealtimeProvider implements RealtimeProvider {
  name = "google-ai-studio";
  descriptor = GOOGLE_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: [API_KEY_ENVIRONMENT_VARIABLE],
  };
  models = SESSION_MODELS_BY_TYPE.realtime;

  private getProviderKeyName(): string {
    return API_KEY_ENVIRONMENT_VARIABLE;
  }

  async getApiKey(request: RealtimeSessionRequest): Promise<string> {
    return resolveProviderApiKey({
      env: request.env,
      providerName: this.name,
      envKeyName: this.getProviderKeyName(),
      userId: request.user.id,
      credentialAuthority: request.credentialAuthority,
    });
  }

  getDefaultModel(type: RealtimeSessionRequest["type"]): string {
    if (type !== "realtime") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    return DEFAULT_REALTIME_MODEL;
  }

  buildAudioFormat(): Record<string, unknown> {
    return {
      type: "audio/pcm",
      rate: 24000,
    };
  }

  private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
    const requestedModel = request.model || this.getDefaultModel(request.type);
    const supportedModels = SESSION_MODELS_BY_TYPE[request.type];

    if (!supportedModels.includes(requestedModel)) {
      throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
    }

    const modelConfig = await getModelConfigByModel(requestedModel, request.env);

    if (!modelConfig || modelConfig.provider !== this.name) {
      throw new AssistantError(
        `Model configuration not found for ${requestedModel}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return modelConfig.matchingModel;
  }

  private getTransport(request: RealtimeSessionRequest): RealtimeTransport {
    const transport = request.transport ?? DEFAULT_TRANSPORT;

    if (transport !== "websocket") {
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

    return request.outputModalities ?? DEFAULT_OUTPUT_MODALITIES_BY_TYPE[request.type];
  }

  private buildRealtimeInputConfig(
    inputModalities: RealtimeModality[],
  ): Record<string, unknown> | undefined {
    if (!inputModalities.includes("video")) {
      return undefined;
    }

    return {
      turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
    };
  }

  private buildLiveConfig({
    request,
    inputModalities,
    outputModalities,
  }: {
    request: RealtimeSessionRequest;
    inputModalities: RealtimeModality[];
    outputModalities: RealtimeModality[];
  }): Record<string, unknown> {
    const responseModalities = outputModalities.map((modality) => modality.toUpperCase());
    const realtimeInputConfig = this.buildRealtimeInputConfig(inputModalities);

    return {
      responseModalities,
      ...(outputModalities.includes("audio")
        ? {
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: request.voice ?? DEFAULT_VOICE,
                },
              },
            },
          }
        : {}),
      ...(realtimeInputConfig ? { realtimeInputConfig } : {}),
      ...(request.instructions
        ? {
            systemInstruction: {
              parts: [{ text: request.instructions }],
            },
          }
        : {}),
      sessionResumption: {},
      contextWindowCompression: { slidingWindow: {} },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };
  }

  private buildLiveSetup(model: string, config: Record<string, unknown>): Record<string, unknown> {
    const { responseModalities, speechConfig, ...setupConfig } = config;

    return {
      model: formatGoogleStudioModelResource(model),
      generationConfig: {
        responseModalities,
        ...(speechConfig ? { speechConfig } : {}),
      },
      ...setupConfig,
    };
  }

  private buildTokenRequestBody(
    request: RealtimeSessionRequest,
    model: string,
    inputModalities: RealtimeModality[],
    outputModalities: RealtimeModality[],
  ): Record<string, unknown> {
    const now = Date.now();
    const config = this.buildLiveConfig({ request, inputModalities, outputModalities });

    return {
      uses: 1,
      expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
      newSessionExpireTime: new Date(now + NEW_SESSION_LIFETIME_MS).toISOString(),
      liveConnectConstraints: {
        model: formatGoogleStudioModelResource(model),
        config,
      },
    };
  }

  private buildWebSocketUrl(token: string): string {
    const url = new URL(LIVE_WEBSOCKET_URL);

    url.searchParams.set("access_token", token);

    return url.toString();
  }

  async createSession(request: RealtimeSessionRequest): Promise<unknown> {
    if (request.type !== "realtime") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    const transport = this.getTransport(request);
    const inputModalities = this.getInputModalities(request);
    const outputModalities = this.getOutputModalities(request);
    const model = await this.resolveModel(request);
    const apiKey = await this.getApiKey(request);
    const config = this.buildLiveConfig({ request, inputModalities, outputModalities });
    const setup = this.buildLiveSetup(model, config);
    const body = this.buildTokenRequestBody(request, model, inputModalities, outputModalities);

    const response = await fetch(AUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Failed to create Gemini Live session"),
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    const token = (await response.json()) as GoogleAuthTokenResponse;

    if (!token.name) {
      throw new AssistantError("Gemini Live session token missing", ErrorType.PROVIDER_ERROR);
    }

    const audioOutput = outputModalities.includes("audio")
      ? {
          output: {
            format: this.buildAudioFormat(),
            voice: request.voice ?? DEFAULT_VOICE,
          },
        }
      : {};

    return {
      id: token.name,
      object: "realtime.session",
      type: "realtime",
      provider: this.name,
      transport,
      protocol: "gemini-live",
      model,
      input_modalities: inputModalities,
      output_modalities: outputModalities,
      modalities: outputModalities,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 16000,
          },
        },
        ...audioOutput,
      },
      client_secret: {
        value: token.name,
        expires_at: token.expireTime
          ? Math.floor(new Date(token.expireTime).getTime() / 1000)
          : undefined,
      },
      url: this.buildWebSocketUrl(token.name),
      setup,
    };
  }
}

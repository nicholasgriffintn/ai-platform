import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { formatProviderError } from "../../../utils/errors.js";
import type { RealtimeProvider, RealtimeSessionRequest } from "../index.js";

export const MISTRAL_VOICE_AGENT_DESCRIPTOR = {
  id: "mistral-voice",
  order: 3,
  label: "Mistral Voice Agent",
  shortLabel: "Mistral Voice",
  liveMode: "native",
  transport: "livekit",
  sessionType: "realtime",
  inputModalities: ["audio"],
  outputModalities: ["audio", "text"],
  description: "Hosted Voxtral 3 voice agent with web search",
  defaultModelId: "voxtral-voice-agent",
} satisfies RealtimeLiveProviderDescriptor;

const MISTRAL_SESSIONS_URL = "https://api.mistral.ai/v1/audio/sessions";
const MISTRAL_VOICE_AGENT_LLM = "mistral-small-latest";
const MISTRAL_VOICE_AGENT_STT = "voxtral-mini-transcribe-realtime-3";
const MISTRAL_VOICE_AGENT_TTS = "voxtral-mini-tts-3";
const MISTRAL_VOICE_AGENT_VOICE = "voice_1787";
const MISTRAL_VOICE_AGENT_INSTRUCTIONS =
  "You are Polychat, a helpful voice assistant. Answer in short, natural spoken sentences and use web search when the answer depends on current information.";

const mistralVoiceSessionSchema = z.object({
  id: z.string().min(1),
  participant_token: z.string().min(1),
  server_url: z.string().url(),
  expires_at: z.string(),
});

export function buildMistralVoiceAgentSessionRequest(
  request: Pick<RealtimeSessionRequest, "instructions" | "language" | "voice" | "vocabulary">,
): Record<string, unknown> {
  return {
    instructions: request.instructions ?? MISTRAL_VOICE_AGENT_INSTRUCTIONS,
    llm: { model: MISTRAL_VOICE_AGENT_LLM },
    stt: {
      model: MISTRAL_VOICE_AGENT_STT,
      ...(request.language ? { language: request.language } : {}),
      ...(request.vocabulary?.length ? { context_bias: request.vocabulary } : {}),
      turn_detection: {},
    },
    tts: {
      model: MISTRAL_VOICE_AGENT_TTS,
      voice_id: request.voice ?? MISTRAL_VOICE_AGENT_VOICE,
    },
    tools: [{ type: "web_search" }],
    turn: { allow_interruptions: true },
  };
}

export class MistralVoiceAgentProvider implements RealtimeProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = MISTRAL_VOICE_AGENT_DESCRIPTOR.id;
  descriptor = MISTRAL_VOICE_AGENT_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: ["MISTRAL_API_KEY"],
    modelProvider: "mistral",
  };
  models = [MISTRAL_VOICE_AGENT_DESCRIPTOR.defaultModelId];

  getDefaultModel(type: RealtimeSessionRequest["type"]): string {
    if (type !== "realtime") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    return MISTRAL_VOICE_AGENT_DESCRIPTOR.defaultModelId;
  }

  async createSession(request: RealtimeSessionRequest): Promise<unknown> {
    if (request.type !== "realtime") {
      throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
    }

    if (request.transport && request.transport !== "livekit") {
      throw new AssistantError("Unsupported realtime transport specified", ErrorType.PARAMS_ERROR);
    }

    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: request.env,
      providerName: this.configuration.modelProvider,
      envKeyName: "MISTRAL_API_KEY",
      userId: request.user.id,
      credentialAuthority: request.credentialAuthority,
    });
    const response = await fetch(MISTRAL_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildMistralVoiceAgentSessionRequest(request)),
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Mistral voice agent session failed"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const parsed = mistralVoiceSessionSchema.safeParse(await response.json());

    if (!parsed.success) {
      throw new AssistantError(
        "Mistral returned an unexpected voice agent session",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const expiresAt = Math.floor(Date.parse(parsed.data.expires_at) / 1000);

    return {
      id: parsed.data.id,
      object: "realtime.session",
      type: "realtime",
      provider: this.name,
      transport: "livekit",
      model: MISTRAL_VOICE_AGENT_DESCRIPTOR.defaultModelId,
      url: parsed.data.server_url,
      client_secret: {
        value: parsed.data.participant_token,
        ...(Number.isFinite(expiresAt) ? { expires_at: expiresAt } : {}),
      },
      input_modalities: MISTRAL_VOICE_AGENT_DESCRIPTOR.inputModalities,
      output_modalities: MISTRAL_VOICE_AGENT_DESCRIPTOR.outputModalities,
    };
  }
}

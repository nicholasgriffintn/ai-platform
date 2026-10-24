import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { base64ToBuffer, bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import { fetchAIResponse } from "../../../fetch.js";
import { formatProviderError } from "../../../utils/errors.js";
import { BaseAudioProvider } from "../base.js";
import {
  getAudioFormatMetadata,
  resolveAudioResponseFormat,
  type AudioResponseFormat,
} from "../formats.js";
import type {
  AudioProvider,
  AudioSynthesisRequest,
  AudioSynthesisResult,
  AudioVoiceCreateRequest,
  AudioVoiceDeleteRequest,
} from "../index.js";

const logger = getLogger({ prefix: "lib/audio/mistral" });

const MISTRAL_TTS_MODEL = "voxtral-mini-tts-3-0";
const DEFAULT_VOICE_ID = "voice_1787";
const MISTRAL_API_BASE_URL = "https://api.mistral.ai";
const MISTRAL_PRESET_VOICE_PATTERN = /^(?:voice_\d+|[a-z]{2}_[a-z]+_[a-z]+)$/;

const mistralVoiceResponseSchema = z.object({ id: z.string().min(1) });

export function isMistralPresetVoiceId(voiceId: string): boolean {
  return MISTRAL_PRESET_VOICE_PATTERN.test(voiceId);
}

type MistralSpeechResponse = {
  audio_data?: unknown;
  eventId?: string;
  log_id?: string;
  cacheStatus?: string;
};

export class MistralAudioProvider extends BaseAudioProvider implements AudioProvider {
  name = "mistral";

  async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
    if (!request.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError("Missing AI_GATEWAY_TOKEN", ErrorType.CONFIGURATION_ERROR);
    }

    const apiKey = await this.resolveApiKey(request);
    const responseFormat = resolveAudioResponseFormat(request.responseFormat);
    const { extension, mimeType } = getAudioFormatMetadata(responseFormat);
    const response = await this.createSpeech(request, apiKey, responseFormat);

    if (typeof response.audio_data !== "string" || response.audio_data.length === 0) {
      throw new AssistantError("No audio data returned by Mistral", ErrorType.PROVIDER_ERROR);
    }

    if (!request.store) {
      return {
        audioBase64: response.audio_data,
        audioDataUrl: `data:${mimeType};base64,${response.audio_data}`,
        audioMimeType: mimeType,
        metadata: this.buildMetadata(request, responseFormat, response),
      };
    }

    const slugBase = this.resolveSlugBase(request);
    const objectKey = this.buildObjectKey(slugBase, extension);
    const storage = this.requireStorage(request);
    const audioData = base64ToBuffer(response.audio_data);

    if (audioData.byteLength === 0) {
      throw new AssistantError("No audio data returned by Mistral", ErrorType.PROVIDER_ERROR);
    }

    await storage.uploadObject(objectKey, audioData);

    return {
      key: objectKey,
      audioMimeType: mimeType,
      metadata: this.buildMetadata(request, responseFormat, response),
    };
  }

  async createVoice(request: AudioVoiceCreateRequest): Promise<{ id: string }> {
    const apiKey = await this.resolveApiKey(request);
    const response = await fetch(`${MISTRAL_API_BASE_URL}/v1/audio/voices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: request.name,
        sample_audio: bufferToBase64(new Uint8Array(await request.sample.arrayBuffer())),
        sample_filename: request.sampleFilename,
      }),
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Mistral could not save the voice"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const parsed = mistralVoiceResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      throw new AssistantError("Mistral returned an unexpected voice", ErrorType.PROVIDER_ERROR);
    }

    return { id: parsed.data.id };
  }

  async deleteVoice(request: AudioVoiceDeleteRequest): Promise<void> {
    const apiKey = await this.resolveApiKey(request);
    const response = await fetch(
      `${MISTRAL_API_BASE_URL}/v1/audio/voices/${encodeURIComponent(request.voiceId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new AssistantError(
        await formatProviderError(response, "Mistral could not delete the voice"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }
  }

  private resolveApiKey(request: Pick<AudioSynthesisRequest, "env" | "user">): Promise<string> {
    return resolveHostProviderApiKey(this.runtime.host, {
      env: request.env,
      providerName: this.name,
      envKeyName: "MISTRAL_API_KEY",
      userId: request.user?.id,
      logger,
    });
  }

  private async createSpeech(
    request: AudioSynthesisRequest,
    apiKey: string,
    responseFormat: AudioResponseFormat,
  ): Promise<MistralSpeechResponse> {
    const voiceInput = request.refAudio
      ? { ref_audio: request.refAudio }
      : { voice_id: request.voice ?? DEFAULT_VOICE_ID };

    return fetchAIResponse<MistralSpeechResponse>(
      false,
      this.name,
      "v1/audio/speech",
      {
        "cf-aig-authorization": request.env.AI_GATEWAY_TOKEN || "",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      {
        model: request.model ?? MISTRAL_TTS_MODEL,
        input: request.input,
        response_format: responseFormat,
        expressiveness: request.expressiveness,
        ...voiceInput,
      },
      request.env,
    );
  }

  private buildMetadata(
    request: AudioSynthesisRequest,
    responseFormat: AudioResponseFormat,
    response: MistralSpeechResponse,
  ): Record<string, unknown> {
    return {
      ...request.metadata,
      engine: "mistral",
      model: request.model ?? MISTRAL_TTS_MODEL,
      voice: request.refAudio ? undefined : (request.voice ?? DEFAULT_VOICE_ID),
      responseFormat,
      expressiveness: request.expressiveness,
      eventId: response.eventId,
      logId: response.log_id,
      cacheStatus: response.cacheStatus,
    };
  }
}

import { gatewayId } from "../../constants/app";
import type { IEnv } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import type { StorageService } from "../storage";

export class ElevenLabsService {
  private readonly provider = "elevenlabs";
  private readonly voiceId = "JBFqnCBsd6RMkjVDRZzb";
  private readonly endpoint = `v1/text-to-speech/${this.voiceId}`;

  constructor(private readonly env: IEnv) {
    if (!this.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN for ElevenLabs",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!this.env.ELEVENLABS_API_KEY) {
      throw new AssistantError(
        "Missing ELEVENLABS_API_KEY",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  async synthesizeSpeech(
    content: string,
    storageService: StorageService,
    slug: string,
    modelId = "eleven_multilingual_v2",
  ): Promise<string> {
    try {
      if (!this.env.AI) {
        throw new AssistantError(
          "AI binding is required for ElevenLabs",
          ErrorType.PARAMS_ERROR,
        );
      }

      const gateway = this.env.AI.gateway(gatewayId);

      const response = await gateway.run({
        provider: this.provider,
        endpoint: this.endpoint,
        headers: {
          "cf-aig-authorization": this.env.AI_GATEWAY_TOKEN,
          "Content-Type": "application/json",
          "xi-api-key": this.env.ELEVENLABS_API_KEY,
        },
        query: {
          text: content,
          model_id: modelId,
          output_format: "mp3_44100_128",
        },
        // @ts-expect-error - types seem to be wrong
        config: {
          requestTimeout: 30000,
          maxAttempts: 2,
          retryDelay: 1000,
          backoff: "exponential",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", errorText);
        throw new AssistantError(
          `Failed to get response from ElevenLabs: ${response.status}`,
          ErrorType.PROVIDER_ERROR,
        );
      }

      const audioData = await response.arrayBuffer();
      if (!audioData || audioData.byteLength === 0) {
        throw new AssistantError(
          "No audio data in ElevenLabs response",
          ErrorType.PROVIDER_ERROR,
        );
      }

      const audioKey = `audio/${slug}.mp3`;

      const bytes = new Uint8Array(audioData);
      await storageService.uploadObject(audioKey, bytes);

      return audioKey;
    } catch (error) {
      console.error("Error generating audio with ElevenLabs:", error);
      throw error;
    }
  }
}

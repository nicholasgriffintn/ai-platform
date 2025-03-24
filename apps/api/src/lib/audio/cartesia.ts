import { gatewayId } from "../../constants/app";
import type { IEnv } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import type { StorageService } from "../storage";

export class CartesiaService {
  private readonly provider = "cartesia";
  private readonly endpoint = "tts/bytes";

  constructor(private readonly env: IEnv) {
    if (!this.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN for Cartesia",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  async synthesizeSpeech(
    content: string,
    storageService: StorageService,
    slug: string,
  ): Promise<string> {
    try {
      if (!this.env.AI) {
        throw new AssistantError(
          "AI binding is required for Cartesia",
          ErrorType.PARAMS_ERROR,
        );
      }

      const gateway = this.env.AI.gateway(gatewayId);

      const WizardmanVoiceId = "87748186-23bb-4158-a1eb-332911b0b708";

      const response = await gateway.run({
        provider: this.provider,
        endpoint: this.endpoint,
        headers: {
          "cf-aig-authorization": this.env.AI_GATEWAY_TOKEN,
          "Content-Type": "application/json",
          "X-API-Key": `Bearer ${this.env.CARTESIA_API_KEY}`,
          "Cartesia-Version": "2024-06-10",
        },
        query: {
          transcript: content,
          model_id: "sonic",
          language: "en",
          voice: {
            mode: "id",
            id: WizardmanVoiceId,
          },
          output_format: {
            container: "mp3",
            bit_rate: 128000,
            sample_rate: 44100,
          },
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
        console.error("Cartesia API error:", errorText);
        throw new AssistantError(
          `Failed to get response from Cartesia: ${response.status}`,
          ErrorType.PROVIDER_ERROR,
        );
      }

      // TODO: I can't get Cartesia working right now, so this is probably wrong.
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
      console.error("Error generating audio with Cartesia:", error);
      throw error;
    }
  }
}

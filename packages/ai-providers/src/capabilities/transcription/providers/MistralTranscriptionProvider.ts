import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import { formatProviderError } from "../../../utils/errors.js";
import { BaseTranscriptionProvider } from "../base.js";
import type { TranscriptionRequest, TranscriptionResult } from "../index.js";

const logger = getLogger({ prefix: "lib/transcription/mistral" });

export class MistralTranscriptionProvider extends BaseTranscriptionProvider {
  name = "mistral";

  protected getProviderKeyName(): string {
    return "MISTRAL_API_KEY";
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    this.validateRequest(request);

    const { audio, env, timestamps = false, user } = request;

    if (!env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN or ACCOUNT_ID",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    try {
      const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
        env,
        providerName: this.name,
        envKeyName: this.getProviderKeyName(),
        userId: user?.id,
        logger,
      });
      const formData = new FormData();

      formData.append("file", audio.file, "audio");

      formData.append("model", "voxtral-mini-2507");
      formData.append("language", "en");

      if (timestamps) {
        formData.append("timestamp_granularities", "segment");
      }

      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${resolveAiGatewayId(env)}/mistral/v1/audio/transcriptions`;

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "cf-aig-authorization": env.AI_GATEWAY_TOKEN,
          "cf-aig-skip-cache": "true",
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new AssistantError(
          await formatProviderError(response, "Mistral transcription failed"),
          ErrorType.EXTERNAL_API_ERROR,
          response.status,
        );
      }

      const result = (await response.json()) as { text?: string };

      if (!result.text) {
        throw new AssistantError(
          "No transcription text returned from Mistral",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        text: result.text,
        data: result,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        await formatProviderError(error, "Mistral transcription error"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}

import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import { formatProviderError } from "../../../utils/errors.js";
import { BaseTranscriptionProvider } from "../base.js";
import type { TranscriptionRequest, TranscriptionResult } from "../index.js";
import { readTranscriptionTimings } from "../timings.js";

const logger = getLogger({ prefix: "lib/transcription/mistral" });

const MISTRAL_MINI_TRANSCRIPTION_MODEL = "voxtral-mini-transcribe-3-0";
const MISTRAL_SMALL_TRANSCRIPTION_MODEL = "voxtral-small-transcribe-3-0";

function resolveMistralTranscriptionModel(model?: string): string {
  return model?.startsWith("voxtral-small")
    ? MISTRAL_SMALL_TRANSCRIPTION_MODEL
    : MISTRAL_MINI_TRANSCRIPTION_MODEL;
}

export class MistralTranscriptionProvider extends BaseTranscriptionProvider {
  name = "mistral";

  protected getProviderKeyName(): string {
    return "MISTRAL_API_KEY";
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    this.validateRequest(request);

    const { audio, env, language, model, timestamps = false, user, vocabulary = [] } = request;

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

      formData.append("model", resolveMistralTranscriptionModel(model));

      if (language) {
        formData.append("language", language);
      }

      if (timestamps) {
        formData.append("timestamp_granularities", "segment");
        formData.append("diarize", "true");
      }

      for (const term of vocabulary) {
        formData.append("context_bias", term);
      }

      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${resolveAiGatewayId()}/mistral/v1/audio/transcriptions`;

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

      const result: unknown = await response.json();
      const { text, segments, words } = readTranscriptionTimings(result);

      if (!text) {
        throw new AssistantError(
          "No transcription text returned from Mistral",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        text,
        segments,
        words,
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

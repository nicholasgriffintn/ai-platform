import { AssistantError, ErrorType } from "~/utils/errors";
import type { TranscriptionRequest, TranscriptionResponse } from "./base";
import { BaseTranscriptionProvider } from "./base";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getModelConfigByMatchingModel } from "~/lib/models";

const REPLICATE_TRANSCRIBE_VERSION =
  "cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f";

export class ReplicateTranscriptionProvider extends BaseTranscriptionProvider {
  name = "replicate";

  protected getProviderKeyName(): string {
    return "REPLICATE_API_TOKEN";
  }

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResponse> {
    this.validateRequest(request);

    const { audio, env, user } = request;

    try {
      const modelConfig = await getModelConfigByMatchingModel(
        REPLICATE_TRANSCRIBE_VERSION,
      );
      const provider = AIProviderFactory.getProvider(
        modelConfig?.provider || "replicate",
      );

      const transcriptionData = await provider.getResponse({
        version: REPLICATE_TRANSCRIBE_VERSION,
        messages: [
          {
            role: "user",
            content: {
              // @ts-ignore - Replicate model requires this format
              file: audio,
              language: "en",
              transcript_output_format: "segments_only",
              group_segments: true,
              translate: false,
              offset_seconds: 0,
            },
          },
        ],
        env,
        user,
      });

      let text = "";
      try {
        const out: any = transcriptionData?.output ?? transcriptionData;
        if (Array.isArray(out?.segments)) {
          text = out.segments
            .map((s: any) => s.text)
            .join(" ")
            .trim();
        } else if (typeof out?.text === "string") {
          text = out.text;
        } else if (typeof transcriptionData?.text === "string") {
          text = transcriptionData.text;
        }
      } catch {}

      if (!text) {
        throw new AssistantError(
          "Failed to parse transcription output from Replicate",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        text,
        data: transcriptionData,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        `Replicate transcription error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}

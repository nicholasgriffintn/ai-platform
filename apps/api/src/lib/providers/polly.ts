import { AwsClient } from "aws4fetch";

import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { BaseProvider } from "./base";

const logger = getLogger({ prefix: "POLY" });

interface PollyResponse {
  SynthesisTask: {
    TaskId: string;
    TaskStatus: string;
    TaskStatusReason?: string;
    OutputUri?: string;
  };
}

export class PollyProvider extends BaseProvider {
  name = "polly";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "polly";
  }

  private parseAwsCredentials(apiKey: string): {
    accessKey: string;
    secretKey: string;
  } {
    const delimiter = "::@@::";
    const parts = apiKey.split(delimiter);

    if (parts.length !== 2) {
      throw new AssistantError(
        "Invalid AWS credentials format",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { accessKey: parts[0], secretKey: parts[1] };
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    const region = params.env.AWS_REGION || "us-east-1";
    return `https://polly.${region}.amazonaws.com/v1/synthesisTasks`;
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const pollyUrl = this.getEndpoint(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        let accessKey = params.env.BEDROCK_AWS_ACCESS_KEY || "";
        let secretKey = params.env.BEDROCK_AWS_SECRET_KEY || "";

        if (userId) {
          try {
            const userApiKey = await this.getApiKey(params, userId);
            if (userApiKey) {
              const credentials = this.parseAwsCredentials(userApiKey);
              if (credentials.accessKey) {
                accessKey = credentials.accessKey;
              }
              if (credentials.secretKey) {
                secretKey = credentials.secretKey;
              }
            }
          } catch (error) {
            logger.warn(
              "Failed to get user AWS credentials, using environment variables:",
              { error },
            );
          }
        }

        const region = "us-east-1";

        const awsClient = new AwsClient({
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          region: region,
        });

        const response = await awsClient.fetch(pollyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Text: params.message,
            OutputFormat: "mp3",
            VoiceId: params.model,
            Engine: "long-form",
            TextType: "ssml",
            OutputS3BucketName: "polly-text-to-speech-input",
            OutputS3KeyPrefix: `polly/${params.options?.slug}`,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new AssistantError(
            `Polly API Error (${response.status}): ${errorBody || response.statusText}`,
            ErrorType.PROVIDER_ERROR,
            response.status,
          );
        }

        const data = (await response.json()) as PollyResponse;

        const taskId = data.SynthesisTask.TaskId;

        while (true) {
          const taskResponse = await awsClient.fetch(`${pollyUrl}/${taskId}`, {
            method: "GET",
          });

          if (!taskResponse.ok) {
            throw new AssistantError(
              `Failed to check task status: ${taskResponse.status}`,
              ErrorType.PROVIDER_ERROR,
              taskResponse.status,
            );
          }

          const taskData = (await taskResponse.json()) as PollyResponse;
          const status = taskData.SynthesisTask.TaskStatus;

          if (status === "completed") {
            if (!taskData.SynthesisTask.OutputUri) {
              throw new AssistantError(
                "Polly synthesis task failed or output URI is missing",
                ErrorType.PROVIDER_ERROR,
              );
            }

            const s3Response = await awsClient.fetch(
              taskData.SynthesisTask.OutputUri,
              { method: "GET" },
            );

            if (!s3Response.ok) {
              const errorBody = await s3Response.text();
              throw new AssistantError(
                `Error fetching Polly audio from S3 (${s3Response.status}): ${errorBody || s3Response.statusText}`,
                ErrorType.EXTERNAL_API_ERROR,
                s3Response.status,
              );
            }

            const audioBuffer = await s3Response.arrayBuffer();
            const audioKey = `audio/${params.options?.slug}.mp3`;

            await params.options?.storageService?.uploadObject(
              audioKey,
              new Uint8Array(audioBuffer),
            );

            return audioKey;
          }

          if (status === "failed") {
            throw new AssistantError(
              `Task failed: ${taskData.SynthesisTask.TaskStatusReason}`,
              ErrorType.PROVIDER_ERROR,
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      },
      analyticsEngine: params.env?.ANALYTICS,
      settings: {
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
        top_k: params.top_k,
        seed: params.seed,
        repetition_penalty: params.repetition_penalty,
        frequency_penalty: params.frequency_penalty,
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}

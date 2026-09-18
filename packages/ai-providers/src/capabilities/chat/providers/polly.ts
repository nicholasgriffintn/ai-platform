import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";

import { trackProviderMetrics } from "../../../metrics.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";
import { parseAwsCredentials } from "../../../utils/helpers.js";
import { BaseProvider } from "./base.js";

const logger = getLogger({ prefix: "lib/providers/polly" });

interface PollyResponse {
  SynthesisTask: {
    TaskId: string;
    TaskStatus: string;
    TaskStatusReason?: string;
    OutputUri?: string;
  };
}

interface PollyStorageService {
  uploadObject: (key: string, data: Uint8Array) => Promise<unknown>;
}

interface PollyProviderOptions {
  returnAudio?: boolean;
  slug?: string;
  storageService?: PollyStorageService;
}

function isPollyStorageService(value: unknown): value is PollyStorageService {
  return isRecord(value) && typeof value.uploadObject === "function";
}

function readPollyProviderOptions(options: unknown): PollyProviderOptions {
  if (!isRecord(options)) {
    return {};
  }

  return {
    returnAudio: options.returnAudio === true,
    slug: typeof options.slug === "string" ? options.slug : undefined,
    storageService: isPollyStorageService(options.storageService)
      ? options.storageService
      : undefined,
  };
}

export class PollyProvider extends BaseProvider {
  name = "polly";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "polly";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const region = params.env.AWS_REGION || "us-east-1";

    return `https://polly.${region}.amazonaws.com/v1/synthesisTasks`;
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const pollyUrl = await this.getEndpoint(params);
    const options = readPollyProviderOptions(params.body);

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model: this.requireModel(params),
      operation: async () => {
        let accessKey = params.env.BEDROCK_AWS_ACCESS_KEY || "";
        let secretKey = params.env.BEDROCK_AWS_SECRET_KEY || "";

        if (userId) {
          try {
            const userApiKey = await this.getApiKey(params, userId);

            if (userApiKey) {
              const credentials = parseAwsCredentials(userApiKey);

              if (credentials.accessKey) {
                accessKey = credentials.accessKey;
              }

              if (credentials.secretKey) {
                secretKey = credentials.secretKey;
              }
            }
          } catch (error) {
            logger.warn("Failed to get user AWS credentials, using environment variables:", {
              error,
            });
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
            OutputS3KeyPrefix: `polly/${options.slug}`,
          }),
        });

        if (!response.ok) {
          throw new AssistantError(
            await formatProviderError(response, "Polly API Error"),
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

            const s3Response = await awsClient.fetch(taskData.SynthesisTask.OutputUri, {
              method: "GET",
            });

            if (!s3Response.ok) {
              throw new AssistantError(
                await formatProviderError(s3Response, "Error fetching Polly audio from S3"),
                ErrorType.EXTERNAL_API_ERROR,
                s3Response.status,
              );
            }

            const audioBuffer = await s3Response.arrayBuffer();
            const audioKey = `audio/${options.slug}.mp3`;

            if (options.returnAudio) {
              const audioBase64 = bufferToBase64(audioBuffer);

              return {
                audioBase64,
                audioDataUrl: `data:audio/mpeg;base64,${audioBase64}`,
                audioMimeType: "audio/mpeg",
              };
            }

            await options.storageService?.uploadObject(audioKey, new Uint8Array(audioBuffer));

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

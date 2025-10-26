import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import {
  createAsyncInvocationMetadata,
  type AsyncInvocationMetadata,
} from "~/lib/async/asyncInvocation";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "./fetch";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

export class ReplicateProvider extends BaseProvider {
  name = "replicate";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "REPLICATE_API_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const lastMessage = params.messages[params.messages.length - 1];
    if (!lastMessage.content) {
      throw new AssistantError(
        "Missing last message content",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/predictions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=30",
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const commonParams = createCommonParameters(
      params,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const streamingParams = shouldEnableStreaming(
      modelConfig,
      this.supportsStreaming,
      params.stream,
    )
      ? { stream: true }
      : {};

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);

    return {
      ...commonParams,
      ...streamingParams,
      ...toolsParams,
    };
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = await this.getEndpoint();
    const headers = await this.getHeaders(params);

    const lastMessage = params.messages[params.messages.length - 1];

    const body: Record<string, any> = {
      version: params.version || params.model,
      input: lastMessage.content,
    };

    return trackProviderMetrics({
      provider: this.name,
      model: params.version || (params.model as string),
      operation: async () => {
        const initialResponse = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        if (initialResponse.status === "succeeded") {
          return await this.formatResponse(initialResponse, params);
        }

        if (!initialResponse.id) {
          throw new AssistantError(
            "Replicate async response did not include an id",
            ErrorType.PROVIDER_ERROR,
          );
        }

        const placeholderContent = [
          {
            type: "text" as const,
            text: "Generation in progress. We'll update this message once the results are ready.",
          },
        ];

        const asyncInvocationData = createAsyncInvocationMetadata({
          provider: this.name,
          id: initialResponse.id,
          type: "replicate.prediction",
          pollIntervalMs: 5000,
          initialResponse,
          context: {
            version: params.version || params.model,
          },
          contentHints: {
            placeholder: placeholderContent,
            failure: [
              {
                type: "text",
                text: "Generation failed. Please try again.",
              },
            ],
          },
        });

        return {
          response: placeholderContent,
          status: "in_progress",
          data: {
            asyncInvocation: asyncInvocationData,
            id: initialResponse.id,
            status: initialResponse.status,
          },
        };
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

  async getAsyncInvocationStatus(
    metadata: AsyncInvocationMetadata,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{
    status: "in_progress" | "completed" | "failed";
    result?: any;
    raw: Record<string, any>;
  }> {
    const apiKey = await this.getApiKey(params, userId);
    const pollHeaders: Record<string, string> = {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
    };

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${metadata.id}`,
      {
        headers: pollHeaders,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new AssistantError(
        `Failed to poll Replicate prediction: ${response.status} - ${errorText}`,
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const data = (await response.json()) as Record<string, any>;
    const status = String(data.status || "").toLowerCase();

    if (status === "succeeded") {
      const formatted = await this.formatResponse(data, params);
      return {
        status: "completed",
        result: formatted,
        raw: data,
      };
    }

    if (
      status === "failed" ||
      status === "canceled" ||
      status === "cancelled"
    ) {
      return {
        status: "failed",
        raw: data,
      };
    }

    return {
      status: "in_progress",
      raw: data,
    };
  }
}

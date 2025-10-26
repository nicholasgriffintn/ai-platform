import { API_PROD_HOST } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, UnifiedAsyncInvocation } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "./fetch";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";
import {
  UnifiedPollingService,
  type PollingResult,
} from "~/lib/async/unifiedPollingService";

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

    if (!params.completion_id) {
      throw new AssistantError("Missing completion_id", ErrorType.PARAMS_ERROR);
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
      // Always use polling - no webhook logic
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

        // Always return unified metadata for async operations
        if (initialResponse.status !== "succeeded") {
          const unifiedMetadata = UnifiedPollingService.createUnifiedMetadata(
            this.name,
            initialResponse.id,
            initialResponse,
            4000, // 4 second polling interval for Replicate
          );

          return {
            response: "Processing request...",
            status: "in_progress",
            data: {
              asyncInvocation: unifiedMetadata,
            },
          };
        }

        return await this.formatResponse(initialResponse, params);
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

  async pollAsyncStatus(
    id: string,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<PollingResult> {
    const apiKey = await this.getApiKey(params, userId);
    const headers = {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${id}`,
      { headers },
    );

    if (!response.ok) {
      throw new AssistantError(
        `Failed to poll Replicate prediction: ${response.statusText}`,
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const data = (await response.json()) as {
      status: string;
      output?: any;
      error?: string;
    };

    if (data.status === "succeeded") {
      return {
        status: "completed",
        result: data.output,
        metadata: {
          provider: "replicate",
          id,
          status: "completed",
          pollIntervalMs: 4000,
          createdAt: Date.now(),
        },
      };
    }

    if (data.status === "failed" || data.error) {
      return {
        status: "failed",
        error: data.error || "Prediction failed",
        metadata: {
          provider: "replicate",
          id,
          status: "failed",
          pollIntervalMs: 4000,
          createdAt: Date.now(),
        },
      };
    }

    return {
      status: "in_progress",
      metadata: {
        provider: "replicate",
        id,
        status: "in_progress",
        pollIntervalMs: 4000,
        createdAt: Date.now(),
      },
    };
  }
}

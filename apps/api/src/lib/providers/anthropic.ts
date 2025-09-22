import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

const logger = getLogger({ prefix: "lib/providers/anthropic" });

export class AnthropicProvider extends BaseProvider {
  name = "anthropic";
  supportsStreaming = true;
  // TODO: Work out if we should use OpenAI compatible mode - it might take away some of the Anthropic-specific features
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "ANTHROPIC_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/messages";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "code-execution-2025-05-22",
      "Content-Type": "application/json",
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

    // Anthropic-specific tools
    const tools = [];
    if (modelConfig?.supportsToolCalls) {
      if (
        modelConfig?.supportsSearchGrounding &&
        params.enabled_tools.includes("search_grounding")
      ) {
        tools.push({
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        });
      }
      if (
        modelConfig?.supportsCodeExecution &&
        params.enabled_tools.includes("code_execution")
      ) {
        tools.push({
          type: "code_execution_20250522",
          name: "code_execution",
        });
      }
    }
    const allTools = [...tools, ...(toolsParams.tools || [])];

    const anthropicSpecificTools =
      modelConfig?.supportsToolCalls && allTools.length > 0
        ? { tools: allTools }
        : {};

    // Handle thinking models
    const supportsThinking = modelConfig?.supportsReasoning || false;
    const thinkingParams = supportsThinking
      ? {
          thinking: {
            type: "enabled",
            budget_tokens: calculateReasoningBudget(params, modelConfig),
          },
          top_p: undefined,
          temperature: 1,
          max_tokens: Math.max(commonParams.max_tokens, 1025),
        }
      : {};

    return {
      ...commonParams,
      ...streamingParams,
      ...toolsParams,
      ...anthropicSpecificTools,
      ...thinkingParams,
      system: params.system_prompt,
      stop_sequences: params.stop,
    };
  }

  async countTokens(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{ inputTokens: number }> {
    this.validateParams(params);

    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const body = {
      model: modelConfig.matchingModel,
      system: params.system_prompt,
      messages: params.messages,
    };

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const apiKey = await this.getApiKey(params, userId);
        const headers = {
          "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          "cf-aig-metadata": JSON.stringify({
            email: params.user?.email,
            userId: params.user?.id,
            platform: params.platform,
            completionId: params.completion_id,
          }),
        };

        const endpoint = `https://gateway.ai.cloudflare.com/v1/${params.env.ACCOUNT_ID}/${gatewayId}/anthropic/v1/messages/count_tokens`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("Failed to count tokens from Anthropic", {
            error: errorText,
            status: response.status,
          });
          throw new AssistantError("Failed to count tokens from Anthropic");
        }

        const data = (await response.json()) as { input_tokens: number };
        return { inputTokens: data.input_tokens };
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
        presence_penalty: params.presence_penalty,
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}

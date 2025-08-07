import { getModelConfigByMatchingModel } from "~/lib/models";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";

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

  protected getEndpoint(): string {
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
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
      }),
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new Error(`Model configuration not found for ${params.model}`);
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
      modelConfig?.supportsToolCalls && tools.length > 0
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
}

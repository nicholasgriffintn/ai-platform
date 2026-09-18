import {
  resolveAdaptiveThinkingEffort,
  shouldEnableProviderThinking,
  usesAdaptiveThinkingApi,
} from "@ngriffin_uk/polychat-ai-models";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitKeys } from "@ngriffin_uk/polychat-utility-server/objects";
import { mergeToolDefinitionsByName } from "@ngriffin_uk/polychat-utility-server/tool-names";

import {
  resolveAiGatewayId,
  getAiGatewayMetadataHeaders,
  resolveAiGatewayCacheTtl,
} from "../../../gateway.js";
import type { ProviderStorage } from "../../../host.js";
import { trackProviderMetrics } from "../../../metrics.js";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "../../../parameters.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { limitAnthropicCacheControlBlocks } from "../../../utils/anthropicCacheControl.js";
import {
  buildAnthropicHostedTools,
  buildAnthropicToolChoice,
} from "../../../utils/anthropicTools.js";
import { formatProviderError } from "../../../utils/errors.js";
import { resolvePrivateAssetUrls } from "../../../utils/privateAssets.js";
import { BaseProvider } from "./base.js";

const ANTHROPIC_SAMPLING_PARAMETERS = ["temperature", "top_p", "top_k"] as const;
const ANTHROPIC_MINIMUM_THINKING_MAX_TOKENS = 1025;

interface AnthropicThinkingParameters {
  params: Record<string, unknown>;
  omitSamplingParameters: boolean;
}

function buildAnthropicThinkingParameters(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
  effectiveMaxTokens: number,
): AnthropicThinkingParameters {
  if (!shouldEnableProviderThinking(modelConfig, params.reasoning_effort)) {
    return { params: {}, omitSamplingParameters: false };
  }

  if (usesAdaptiveThinkingApi(modelConfig)) {
    const effort = resolveAdaptiveThinkingEffort(modelConfig, params.reasoning_effort);

    return {
      params: {
        thinking: { type: "adaptive" },
        ...(effort ? { output_config: { effort } } : {}),
        max_tokens: effectiveMaxTokens,
      },
      omitSamplingParameters: true,
    };
  }

  return {
    params: {
      thinking: {
        type: "enabled",
        budget_tokens: calculateReasoningBudget(params, modelConfig),
      },
      top_p: undefined,
      temperature: 1,
      max_tokens: Math.max(effectiveMaxTokens, ANTHROPIC_MINIMUM_THINKING_MAX_TOKENS),
    },
    omitSamplingParameters: false,
  };
}

export class AnthropicProvider extends BaseProvider {
  name = "anthropic";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "ANTHROPIC_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/messages";
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);
    const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

    return {
      ...baseHeaders,
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const providerParams = storageService
      ? await resolvePrivateAssetUrls({ params, storageService, assetsUrl })
      : params;
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      providerParams.model || "",
      providerParams.env,
      providerParams.provider || this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${providerParams.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const commonParams = createCommonParameters(
      providerParams,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const streamingParams = shouldEnableStreaming(
      modelConfig,
      this.supportsStreaming,
      providerParams.stream,
    )
      ? { stream: true }
      : {};

    const toolsParams = getToolsForProvider(providerParams, modelConfig, this.name);
    const tools = buildAnthropicHostedTools(providerParams, modelConfig);
    const allTools = mergeToolDefinitionsByName(tools, toolsParams.tools || []);

    const lastTool = allTools.at(-1);

    if (lastTool) {
      lastTool.cache_control = { type: "ephemeral" };
    }

    const anthropicSpecificTools =
      modelConfig?.supportsToolCalls && allTools.length > 0 ? { tools: allTools } : {};

    const toolChoice =
      allTools.length > 0 && modelConfig?.supportsToolChoice !== false
        ? buildAnthropicToolChoice(providerParams.tool_choice, providerParams.parallel_tool_calls)
        : undefined;

    const thinking = buildAnthropicThinkingParameters(
      providerParams,
      modelConfig,
      commonParams.max_tokens,
    );

    const systemPromptParams = providerParams.system_prompt
      ? {
          system: [
            {
              type: "text" as const,
              text: providerParams.system_prompt,
              cache_control: { type: "ephemeral" },
            },
          ],
        }
      : {};

    const payload: Record<string, any> = {
      ...commonParams,
      ...streamingParams,
      ...anthropicSpecificTools,
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      ...thinking.params,
      ...systemPromptParams,
      stop_sequences: providerParams.stop,
    };

    return limitAnthropicCacheControlBlocks(
      thinking.omitSamplingParameters ? omitKeys(payload, ANTHROPIC_SAMPLING_PARAMETERS) : payload,
    );
  }

  async countTokens(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{ inputTokens: number }> {
    this.validateParams(params);

    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      params.provider || this.name,
    );

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

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model: this.requireModel(params),
      operation: async () => {
        const apiKey = await this.getApiKey(params, userId);
        const headers = {
          "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
          "cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
        };

        const endpoint = `https://gateway.ai.cloudflare.com/v1/${params.env.ACCOUNT_ID}/${resolveAiGatewayId(params.env)}/anthropic/v1/messages/count_tokens`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new AssistantError(
            await formatProviderError(response, "Failed to count tokens with Anthropic"),
            ErrorType.PROVIDER_ERROR,
            response.status,
          );
        }

        const data = (await response.json()) as { input_tokens: number };

        return { inputTokens: data.input_tokens };
      },
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

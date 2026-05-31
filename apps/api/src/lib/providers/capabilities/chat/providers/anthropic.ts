import { gatewayId } from "~/constants/app";
import { trackProviderMetrics } from "~/lib/monitoring";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { shouldEnableProviderThinking } from "~/lib/providers/models/reasoning";
import { limitAnthropicCacheControlBlocks } from "~/lib/providers/utils/anthropicCacheControl";
import { buildAnthropicHostedTools } from "~/lib/providers/utils/anthropicTools";
import { formatProviderError } from "~/lib/providers/utils/errors";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "~/utils/aiGateway";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { mergeToolDefinitionsByName } from "~/utils/toolNames";
import {
	calculateReasoningBudget,
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";

const logger = getLogger({ prefix: "lib/providers/anthropic" });

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
		const apiKey = await this.getApiKey(params, params.user?.id);
		const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

		return {
			...baseHeaders,
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		};
	}

	async mapParameters(
		params: ChatCompletionParameters,
		_storageService?: StorageService,
		_assetsUrl?: string,
	): Promise<Record<string, any>> {
		const modelConfig = await getModelConfigByMatchingModel(
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
		const tools = buildAnthropicHostedTools(params, modelConfig);
		const allTools = mergeToolDefinitionsByName(tools, toolsParams.tools || []);

		if (allTools.length > 0) {
			const lastTool = allTools[allTools.length - 1];
			lastTool.cache_control = { type: "ephemeral" };
		}

		const anthropicSpecificTools =
			modelConfig?.supportsToolCalls && allTools.length > 0 ? { tools: allTools } : {};

		const shouldEnableThinking = shouldEnableProviderThinking(modelConfig, params.reasoning_effort);
		const thinkingParams = shouldEnableThinking
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

		const systemPromptParams = params.system_prompt
			? {
					system: [
						{
							type: "text" as const,
							text: params.system_prompt,
							cache_control: { type: "ephemeral" },
						},
					],
				}
			: {};

		return limitAnthropicCacheControlBlocks({
			...commonParams,
			...streamingParams,
			...toolsParams,
			...anthropicSpecificTools,
			...thinkingParams,
			...systemPromptParams,
			stop_sequences: params.stop,
		});
	}

	async countTokens(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<{ inputTokens: number }> {
		this.validateParams(params);

		const modelConfig = await getModelConfigByMatchingModel(
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
					"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
					"cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
				};

				const endpoint = `https://gateway.ai.cloudflare.com/v1/${params.env.ACCOUNT_ID}/${gatewayId}/anthropic/v1/messages/count_tokens`;

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

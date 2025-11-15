import { availableFunctions } from "~/services/functions";
import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { formatToolCalls } from "../lib/chat/tools";

/**
 * Restricts max_tokens to the model's configured maximum
 * @param requestedMaxTokens - The user-requested max tokens
 * @param modelMaxTokens - The model's configured maximum tokens
 * @returns The effective max tokens (never exceeds model limit)
 */
export function getEffectiveMaxTokens(
	requestedMaxTokens: number | undefined,
	modelMaxTokens: number | undefined,
): number {
	const defaultMaxTokens = 4096;
	const modelLimit = modelMaxTokens || defaultMaxTokens;
	const requested = requestedMaxTokens || modelLimit;
	return Math.min(requested, modelLimit);
}

/**
 * Merges default parameters with user-provided parameters
 * @param params - The user-provided parameters
 * @param defaults - The default parameters
 * @returns The merged parameters
 */
export function mergeParametersWithDefaults(
	params: Partial<ChatCompletionParameters>,
	defaults: Partial<ChatCompletionParameters> = {},
): ChatCompletionParameters {
	return {
		...defaults,
		...params,
		rag_options: {
			...defaults.rag_options,
			...params.rag_options,
		},
	} as ChatCompletionParameters;
}

export function calculateReasoningBudget(
	params: ChatCompletionParameters,
	modelConfig?: ModelConfigItem,
): number {
	const reasoningEffort = params.reasoning_effort;

	if (reasoningEffort === "none") {
		return 0;
	}

	const effectiveMaxTokens = getEffectiveMaxTokens(
		params.max_tokens,
		modelConfig?.maxTokens,
	);

	if (!effectiveMaxTokens) {
		return 1024;
	}

	switch (reasoningEffort) {
		case "low":
			return Math.max(Math.floor(effectiveMaxTokens * 0.5), 1024);
		case "medium":
			return Math.max(Math.floor(effectiveMaxTokens * 0.75), 1024);
		case "high":
			return Math.max(Math.floor(effectiveMaxTokens * 0.9), 1024);
		default:
			return Math.max(Math.floor(effectiveMaxTokens * 0.75), 1024);
	}
}

function returnValidatedPenalty(
	key: "repetition_penalty" | "frequency_penalty" | "presence_penalty",
	value: number | undefined,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (key === "repetition_penalty") {
		if (value < 0 || value > 2) {
			throw new AssistantError(
				"Repetition penalty must be between 0 and 2, inclusive.",
				ErrorType.PARAMS_ERROR,
			);
		}
	} else if (value < -2) {
		throw new AssistantError(
			`${key} must be greater than or equal to -2.`,
			ErrorType.PARAMS_ERROR,
		);
	}

	return value;
}

/**
 * Creates common parameters that most providers use
 * @param params - The chat completion parameters
 * @param modelConfig - The model configuration
 * @param providerName - The provider name for compatibility checks
 * @param isOpenAiCompatible - Whether the provider is OpenAI compatible
 * @returns Common parameters object
 */
export function createCommonParameters(
	params: ChatCompletionParameters,
	modelConfig: any,
	providerName: string,
	isOpenAiCompatible = false,
): Record<string, any> {
	const modelName = isOpenAiCompatible
		? `${providerName}/${params.model}`
		: params.model;

	const commonParams: Record<string, any> = {
		model: modelName,
		messages: params.messages,
	};

	if (modelConfig.supportsTemperature !== false) {
		commonParams.temperature = params.temperature;
	}

	if (params.version) {
		commonParams.version = params.version;
	}

	if (providerName !== "anthropic") {
		commonParams.seed = params.seed;
		if (modelConfig.matchingModel !== "grok-4-latest") {
			commonParams.repetition_penalty = returnValidatedPenalty(
				"repetition_penalty",
				params.repetition_penalty,
			);
			commonParams.frequency_penalty = returnValidatedPenalty(
				"frequency_penalty",
				params.frequency_penalty,
			);
			if (modelConfig.supportsPresencePenalty !== false) {
				commonParams.presence_penalty = returnValidatedPenalty(
					"presence_penalty",
					params.presence_penalty,
				);
			}
		}
	}

	if (providerName === "openai" && params.metadata) {
		commonParams.metadata = params.metadata;
	}

	const effectiveMaxTokens = getEffectiveMaxTokens(
		params.max_tokens,
		modelConfig?.maxTokens,
	);

	if (providerName === "openai") {
		commonParams.max_completion_tokens = effectiveMaxTokens;
	} else {
		commonParams.max_tokens = effectiveMaxTokens;
	}

	if (params.model && params.response_format) {
		const supportsResponseFormat = modelConfig?.supportsResponseFormat || false;
		if (supportsResponseFormat) {
			commonParams.response_format = params.response_format;
		}
	}

	if (
		modelConfig.supportsTopP !== false &&
		params.model &&
		!params.should_think
	) {
		if (modelConfig.restrictsCombinedTopPAndTemperature) {
			if (params.temperature !== undefined && params.top_p !== undefined) {
				commonParams.temperature = params.temperature;
				delete commonParams.top_p;
			} else {
				commonParams.top_p = params.top_p;
			}
		} else {
			commonParams.top_p = params.top_p;
		}
	}

	return commonParams;
}

/**
 * Gets tools configuration for a provider if the model supports functions
 * @param params - The chat completion parameters
 * @param modelConfig - The model configuration
 * @param providerName - The provider name
 * @returns Tools configuration object to merge with parameters
 */
export function getToolsForProvider(
	params: ChatCompletionParameters,
	modelConfig: any,
	providerName: string,
): { tools?: any[]; parallel_tool_calls?: boolean; tool_choice?: any } {
	if (!params.model || params.disable_functions || params.response_format) {
		return {};
	}

	const supportsToolCalls = modelConfig?.supportsToolCalls || false;

	if (!supportsToolCalls) {
		return {};
	}

	try {
		const enabledTools = params.enabled_tools || [];
		let tools: any[] = [];

		if (params.tools) {
			const providedTools = params.tools;
			const filteredFunctions = availableFunctions
				.filter((func) => enabledTools.includes(func.name))
				.filter(
					(func) =>
						modelConfig?.supportsSearchGrounding && func.name === "web_search",
				);
			const availableToolDeclarations = formatToolCalls(
				providerName,
				filteredFunctions,
			);
			tools = [...availableToolDeclarations, ...providedTools];
		} else {
			const filteredFunctions = availableFunctions.filter((func) =>
				enabledTools.includes(func.name),
			);
			tools = formatToolCalls(providerName, filteredFunctions);
		}

		const result: {
			tools?: any[];
			parallel_tool_calls?: boolean;
			tool_choice?: any;
		} = {};

		if (tools.length > 0) {
			result.tools = tools;
		}

		if (
			params.model !== "o1" &&
			params.model !== "o3" &&
			params.model !== "o3-mini" &&
			params.model !== "o4-mini"
		) {
			result.parallel_tool_calls = params.parallel_tool_calls;
		}

		result.tool_choice = params.tool_choice;

		return result;
	} catch (error: any) {
		throw new AssistantError(
			`Failed to format tool calls: ${error.message}`,
			ErrorType.PARAMS_ERROR,
		);
	}
}

/**
 * Checks if streaming is supported for the model type
 * @param modelConfig - The model configuration
 * @param supportsStreaming - Whether the provider supports streaming
 * @param stream - Whether streaming is requested
 * @returns Whether streaming should be enabled
 */
export function shouldEnableStreaming(
	modelConfig: ModelConfigItem,
	supportsStreaming: boolean,
	stream: boolean,
): boolean {
	if (!modelConfig?.modalities) {
		return false;
	}

	const inputs = modelConfig.modalities.input ?? [];
	const outputs = modelConfig.modalities.output ?? inputs;
	const supportsTextOutput =
		outputs.includes("text") || (!outputs.length && inputs.includes("text"));
	const isCodingModel = modelConfig?.promptTemplate === "coding";
	const modelTypeSupportsStreaming = supportsTextOutput || isCodingModel;

	return stream && supportsStreaming && modelTypeSupportsStreaming;
}

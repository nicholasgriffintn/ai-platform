import type { ModelConfigItem } from "@assistant/schemas";
import type { ChatCompletionParameters, Message } from "~/types";
import { MessageFormatter } from "~/lib/formatter";
import {
	hasProviderReasoningOptions,
	shouldSendProviderReasoningEffort,
} from "~/lib/providers/models/reasoning";
import { hasModelTextOutput, producesNonTextPrimaryOutput } from "~/lib/providers/models/utils";
import { shouldSendProviderVerbosity } from "~/lib/providers/models/verbosity";
import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray, isRecord } from "~/utils/objects";
import { type OptionBag, readOptionBag, readRecordOption } from "~/utils/options";
import { createSamplingParameters, getEffectiveMaxTokens } from "~/utils/parameters";
import { buildOpenAIResponsesTools } from "./openaiResponsesTools";

function supportsOpenAIResponsesModel(modelConfig: ModelConfigItem): boolean {
	return (
		!!modelConfig.supportsToolCalls &&
		hasModelTextOutput(modelConfig) &&
		!producesNonTextPrimaryOutput(modelConfig)
	);
}

export function shouldUseOpenAIResponsesApi(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): boolean {
	if (params.use_responses === false) {
		return false;
	}

	if (params.use_responses === true) {
		return hasModelTextOutput(modelConfig) && !producesNonTextPrimaryOutput(modelConfig);
	}

	return supportsOpenAIResponsesModel(modelConfig);
}

function getOpenAIResponseId(message: Message): string | undefined {
	const data = message.data;
	if (!isRecord(data)) {
		return undefined;
	}

	if (typeof data.openai_response_id === "string") {
		return data.openai_response_id;
	}

	return undefined;
}

function getPreviousResponseState(
	params: ChatCompletionParameters,
	store: boolean | undefined,
): { id: string; messageIndex?: number; source: "explicit" | "history" } | undefined {
	const explicitPreviousResponseId = params.previous_response_id;
	if (typeof explicitPreviousResponseId === "string") {
		return { id: explicitPreviousResponseId, source: "explicit" };
	}

	if (
		store === false ||
		params.auto_previous_response_id === false ||
		params.conversation !== undefined
	) {
		return undefined;
	}

	const messages = params.messages || [];
	for (let index = messages.length - 1; index >= 0; index--) {
		const responseId = getOpenAIResponseId(messages[index]);
		if (responseId) {
			return { id: responseId, messageIndex: index, source: "history" };
		}
	}

	return undefined;
}

function buildResponsesInput(
	params: ChatCompletionParameters,
	previousResponseState?: { messageIndex?: number; source: "explicit" | "history" },
): unknown {
	const explicitInput = params.input;
	if (explicitInput !== undefined) {
		return explicitInput;
	}

	const allMessages = params.messages || [];
	const messages =
		previousResponseState?.source === "history" && previousResponseState.messageIndex !== undefined
			? allMessages.slice(previousResponseState.messageIndex + 1)
			: allMessages;

	const formattedInput = MessageFormatter.formatOpenAIResponsesInput(messages);
	const fallbackInput =
		formattedInput.length === 0 && messages.length !== allMessages.length
			? MessageFormatter.formatOpenAIResponsesInput(allMessages)
			: formattedInput;
	const extraInputItems = params.input_items;

	return Array.isArray(extraInputItems) ? [...fallbackInput, ...extraInputItems] : fallbackInput;
}

function buildResponsesTextFormat(responseFormat: unknown): unknown {
	if (!isRecord(responseFormat)) {
		return responseFormat;
	}

	if (responseFormat.type !== "json_schema" || !isRecord(responseFormat.json_schema)) {
		return responseFormat;
	}

	const jsonSchema = responseFormat.json_schema;
	return {
		type: "json_schema",
		name: jsonSchema.name,
		description: jsonSchema.description,
		schema: jsonSchema.schema,
		strict: jsonSchema.strict,
	};
}

function buildResponsesTextParams(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, any> {
	const textOptions = isRecord(params.text) ? params.text : {};
	const format = buildResponsesTextFormat(params.response_format || textOptions.format);
	const verbositySetting = params.verbosity;
	const verbosity = shouldSendProviderVerbosity(modelConfig, verbositySetting)
		? verbositySetting
		: undefined;

	const text = {
		...textOptions,
		...(format ? { format } : {}),
		...(verbosity ? { verbosity } : {}),
	};

	return Object.keys(text).length ? { text } : {};
}

function buildResponsesReasoningParams(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	options: OptionBag,
): Record<string, any> {
	const reasoningOptions = readRecordOption(options, "reasoning");
	const reasoningEffort = params.reasoning_effort;
	const effort = shouldSendProviderReasoningEffort(modelConfig, reasoningEffort)
		? reasoningEffort
		: undefined;
	const reasoning = {
		...reasoningOptions,
		...(effort ? { effort } : {}),
	};

	return Object.keys(reasoning).length ? { reasoning } : {};
}

function isChatFunctionToolChoice(
	toolChoice: unknown,
): toolChoice is { type: "function"; function: { name: string } } {
	return (
		isRecord(toolChoice) &&
		toolChoice.type === "function" &&
		isRecord(toolChoice.function) &&
		typeof toolChoice.function.name === "string"
	);
}

function buildResponsesToolChoice(toolChoice: ChatCompletionParameters["tool_choice"]): unknown {
	if (isChatFunctionToolChoice(toolChoice)) {
		return {
			type: "function",
			name: toolChoice.function.name,
		};
	}

	return toolChoice;
}

function getResponsesStoreValue(
	params: ChatCompletionParameters,
	_options: OptionBag,
): boolean | undefined {
	return typeof params.store === "boolean" ? params.store : undefined;
}

function buildResponsesInclude(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	options: OptionBag,
	tools: any[],
): string[] | undefined {
	const include = new Set(coerceStringArray(params.include));
	const includeDefaults = params.include_defaults !== false;
	const store = getResponsesStoreValue(params, options);

	if (
		params.include_encrypted_reasoning === true ||
		(includeDefaults && store === false && hasProviderReasoningOptions(modelConfig))
	) {
		include.add("reasoning.encrypted_content");
	}

	if (
		includeDefaults &&
		tools.some((tool) => tool?.type === "code_interpreter") &&
		readRecordOption(options, "code_interpreter").include_outputs !== false
	) {
		include.add("code_interpreter_call.outputs");
	}

	if (
		tools.some((tool) => tool?.type === "file_search") &&
		readRecordOption(options, "file_search").include_results === true
	) {
		include.add("file_search_call.results");
	}

	if (
		tools.some((tool) => tool?.type === "web_search") &&
		readRecordOption(options, "web_search").include_sources === true
	) {
		include.add("web_search_call.action.sources");
	}

	if (
		tools.some((tool) => tool?.type === "computer") &&
		readRecordOption(options, "computer_use").include_output_image_url === true
	) {
		include.add("computer_call_output.output.image_url");
	}

	return include.size ? [...include] : undefined;
}

export function buildOpenAIResponsesBody(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	functionTools: any[] = [],
	streamingParams: Record<string, any> = {},
): Record<string, any> {
	const toolOptions = readOptionBag(params.tool_options);
	const tools = buildOpenAIResponsesTools(params, modelConfig, functionTools);
	const store = getResponsesStoreValue(params, toolOptions);
	const background = params.background;

	if (background === true && store === false) {
		throw new AssistantError(
			"OpenAI background Responses require store=true so the response can be retrieved later.",
			ErrorType.PARAMS_ERROR,
		);
	}

	const previousResponseState = getPreviousResponseState(params, store);
	const include = buildResponsesInclude(params, modelConfig, toolOptions, tools);
	const conversation = params.conversation;

	return {
		model: modelConfig.matchingModel || params.model,
		input: buildResponsesInput(params, previousResponseState),
		instructions: MessageFormatter.formatOpenAIResponsesInstructions(
			params.messages || [],
			params.system_prompt,
		),
		...(tools.length ? { tools } : {}),
		...streamingParams,
		...createSamplingParameters(params, modelConfig),
		...buildResponsesTextParams(params, modelConfig),
		...buildResponsesReasoningParams(params, modelConfig, toolOptions),
		max_output_tokens: getEffectiveMaxTokens(params.max_tokens, modelConfig.maxTokens),
		parallel_tool_calls: params.parallel_tool_calls,
		tool_choice: buildResponsesToolChoice(params.tool_choice),
		store,
		metadata: params.metadata,
		truncation: params.truncation,
		...(conversation ? { conversation } : {}),
		...(previousResponseState?.id && !conversation
			? { previous_response_id: previousResponseState.id }
			: {}),
		...(include ? { include } : {}),
		...(typeof background === "boolean" ? { background } : {}),
		prompt_cache_key: params.prompt_cache_key,
		prompt_cache_retention: params.prompt_cache_retention,
		service_tier: params.service_tier,
		max_tool_calls: params.max_tool_calls,
		stream_options: params.stream_options,
		safety_identifier: params.safety_identifier || params.context?.user?.id?.toString(),
	};
}

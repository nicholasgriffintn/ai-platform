import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { formatToolCalls } from "~/lib/chat/tools";
import { MessageFormatter } from "~/lib/formatter";
import { listFunctionTools } from "~/services/functions";
import { getEffectiveMaxTokens } from "~/utils/parameters";

type OpenAIOptions = Record<string, any>;
const TOOL_SEARCH_NAMESPACE_SIZE = 10;

function getOpenAIOptions(params: ChatCompletionParameters): OpenAIOptions {
	const options = params.options || {};
	return {
		...options,
		...(options.openai && typeof options.openai === "object" ? options.openai : {}),
	};
}

function hasEnabledTool(params: ChatCompletionParameters, ...toolIds: string[]): boolean {
	const enabledTools = new Set(params.enabled_tools || []);
	return toolIds.some((toolId) => enabledTools.has(toolId));
}

function buildCodeInterpreterTool(options: OpenAIOptions): Record<string, any> {
	const codeInterpreterOptions = options.code_interpreter || {};
	return {
		type: "code_interpreter",
		container: codeInterpreterOptions.container || { type: "auto" },
	};
}

function buildHostedShellTool(options: OpenAIOptions): Record<string, any> {
	const shellOptions = options.shell || {};
	return {
		type: "shell",
		environment: shellOptions.environment || { type: "container_auto" },
	};
}

function convertFunctionToolsToResponsesTools(tools: any[] = []): any[] {
	return tools.map((tool) => {
		if (tool.type !== "function" || !tool.function) {
			return tool;
		}

		return {
			type: "function",
			name: tool.function.name,
			description: tool.function.description,
			parameters: tool.function.parameters,
			...(tool.function.strict !== undefined ? { strict: tool.function.strict } : {}),
		};
	});
}

function getResponseFunctionName(tool: any): string | undefined {
	return typeof tool?.name === "string"
		? tool.name
		: typeof tool?.function?.name === "string"
			? tool.function.name
			: undefined;
}

function buildToolSearchNamespaces(immediateFunctionTools: any[]): any[] {
	const immediateNames = new Set(
		immediateFunctionTools
			.map((tool) => getResponseFunctionName(tool))
			.filter((name): name is string => typeof name === "string"),
	);
	const deferredFunctions = listFunctionTools().filter((tool) => !immediateNames.has(tool.name));
	const deferredTools = convertFunctionToolsToResponsesTools(
		formatToolCalls("openai", deferredFunctions),
	)
		.filter((tool) => tool?.type === "function" && typeof tool.name === "string")
		.map((tool) => ({
			...tool,
			defer_loading: true,
		}));

	const namespaces = [];
	for (let index = 0; index < deferredTools.length; index += TOOL_SEARCH_NAMESPACE_SIZE) {
		const tools = deferredTools.slice(index, index + TOOL_SEARCH_NAMESPACE_SIZE);
		namespaces.push({
			type: "namespace",
			name: `assistant_tools_${Math.floor(index / TOOL_SEARCH_NAMESPACE_SIZE) + 1}`,
			description: `Assistant application tools. Includes: ${tools
				.map((tool) => tool.name)
				.join(", ")}.`,
			tools,
		});
	}

	return namespaces;
}

function buildOpenAIResponsesTools(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	functionTools: any[] = [],
): any[] {
	const options = getOpenAIOptions(params);
	const tools: any[] = [];

	if (
		modelConfig.supportsSearchGrounding &&
		hasEnabledTool(params, "search_grounding", "web_search")
	) {
		tools.push({ type: "web_search" });
	}

	if (
		modelConfig.supportsCodeExecution &&
		hasEnabledTool(params, "code_execution", "code_interpreter")
	) {
		tools.push(buildCodeInterpreterTool(options));
	}

	if (modelConfig.supportsImageGenerationTool && hasEnabledTool(params, "image_generation")) {
		tools.push({ type: "image_generation", ...(options.image_generation || {}) });
	}

	if (modelConfig.supportsHostedShell && hasEnabledTool(params, "hosted_shell")) {
		tools.push(buildHostedShellTool(options));
	}

	const responseFunctionTools = convertFunctionToolsToResponsesTools(functionTools);
	if (modelConfig.supportsToolSearch && hasEnabledTool(params, "tool_search")) {
		const namespaces = buildToolSearchNamespaces(responseFunctionTools);
		tools.push(...responseFunctionTools, ...namespaces, { type: "tool_search" });
	} else {
		tools.push(...responseFunctionTools);
	}

	return tools;
}

export function shouldUseOpenAIResponsesApi(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): boolean {
	if (!modelConfig.supportsToolCalls) {
		return false;
	}

	return (
		(modelConfig.supportsSearchGrounding &&
			hasEnabledTool(params, "search_grounding", "web_search")) ||
		(modelConfig.supportsCodeExecution &&
			hasEnabledTool(params, "code_execution", "code_interpreter")) ||
		(modelConfig.supportsImageGenerationTool && hasEnabledTool(params, "image_generation")) ||
		(modelConfig.supportsToolSearch && hasEnabledTool(params, "tool_search")) ||
		(modelConfig.supportsHostedShell && hasEnabledTool(params, "hosted_shell"))
	);
}

export function buildOpenAIResponsesBody(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	functionTools: any[] = [],
	streamingParams: Record<string, any> = {},
): Record<string, any> {
	const options = getOpenAIOptions(params);
	const tools = buildOpenAIResponsesTools(params, modelConfig, functionTools);
	const textParams =
		params.response_format || params.verbosity
			? {
					text: {
						...(params.response_format ? { format: params.response_format } : {}),
						...(params.verbosity ? { verbosity: params.verbosity } : {}),
					},
				}
			: {};

	return {
		model: modelConfig.matchingModel || params.model,
		input: MessageFormatter.formatOpenAIResponsesInput(params.messages || []),
		instructions: MessageFormatter.formatOpenAIResponsesInstructions(
			params.messages || [],
			params.system_prompt,
		),
		...(tools.length ? { tools } : {}),
		...streamingParams,
		...textParams,
		...(params.reasoning_effort && params.reasoning_effort !== "simulated-thinking"
			? { reasoning: { effort: params.reasoning_effort } }
			: {}),
		max_output_tokens: getEffectiveMaxTokens(params.max_tokens, modelConfig.maxTokens),
		parallel_tool_calls: params.parallel_tool_calls,
		tool_choice: params.tool_choice,
		store: params.store,
		metadata: params.metadata,
		truncation: options.truncation,
		previous_response_id: options.previous_response_id || options.previousResponseId,
		include: options.include,
		user: typeof params.user === "string" ? params.user : params.user?.email,
	};
}

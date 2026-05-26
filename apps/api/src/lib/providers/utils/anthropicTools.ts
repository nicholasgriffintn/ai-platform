import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { readOptionBag, readRecordOption } from "~/utils/options";

export const ANTHROPIC_TOOL_TYPES = {
	codeExecution: "code_execution_20260120",
	webFetch: "web_fetch_20260209",
	webSearch: "web_search_20260209",
} as const;

function stripReservedToolOptions(options: Record<string, any>): Record<string, any> {
	const { name: _name, type: _type, ...toolOptions } = options;
	return toolOptions;
}

function buildAnthropicHostedTool(
	type: (typeof ANTHROPIC_TOOL_TYPES)[keyof typeof ANTHROPIC_TOOL_TYPES],
	name: string,
	defaults: Record<string, any>,
	options: Record<string, any>,
): Record<string, any> {
	return {
		type,
		name,
		...defaults,
		...stripReservedToolOptions(options),
	};
}

export function buildAnthropicHostedTools(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, any>[] {
	if (!modelConfig.supportsToolCalls) {
		return [];
	}

	const enabledTools = params.enabled_tools || [];
	const options = readOptionBag(params.options);
	const tools: Record<string, any>[] = [];

	if (modelConfig.supportsSearchGrounding && enabledTools.includes("search_grounding")) {
		tools.push(
			buildAnthropicHostedTool(
				ANTHROPIC_TOOL_TYPES.webSearch,
				"web_search",
				{ max_uses: 3 },
				readRecordOption(options, "web_search"),
			),
		);
	}

	if (modelConfig.supportsCodeExecution && enabledTools.includes("code_execution")) {
		tools.push(
			buildAnthropicHostedTool(
				ANTHROPIC_TOOL_TYPES.codeExecution,
				"code_execution",
				{},
				readRecordOption(options, "code_execution"),
			),
		);
	}

	if (modelConfig.supportsWebFetch && enabledTools.includes("web_fetch")) {
		tools.push(
			buildAnthropicHostedTool(
				ANTHROPIC_TOOL_TYPES.webFetch,
				"web_fetch",
				{
					max_uses: 5,
					citations: { enabled: true },
				},
				readRecordOption(options, "web_fetch"),
			),
		);
	}

	return tools;
}

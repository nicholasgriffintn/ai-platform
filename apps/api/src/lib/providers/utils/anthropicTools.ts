import type { ModelConfigItem } from "@assistant/schemas";
import type { ChatCompletionParameters } from "~/types";
import { readOptionBag, readRecordOption } from "~/utils/options";

export const ANTHROPIC_TOOL_TYPES = {
	codeExecution: "code_execution_20260120",
	webFetch: "web_fetch_20260209",
	webSearch: "web_search_20260209",
} as const;

export function buildAnthropicHostedTools(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, any>[] {
	return new AnthropicHostedToolBuilder(params, modelConfig).build();
}

class AnthropicHostedToolBuilder {
	private readonly enabledTools: readonly string[];
	private readonly options: ReturnType<typeof readOptionBag>;
	private readonly tools: Record<string, any>[] = [];

	constructor(
		private readonly params: ChatCompletionParameters,
		private readonly modelConfig: ModelConfigItem,
	) {
		this.enabledTools = params.enabled_tools || [];
		this.options = readOptionBag(params.options);
	}

	build(): Record<string, any>[] {
		if (!this.modelConfig.supportsToolCalls) {
			return [];
		}

		this.addWebSearch();
		this.addCodeExecution();
		this.addWebFetch();
		return this.tools;
	}

	private addWebSearch() {
		if (
			this.modelConfig.supportsSearchGrounding &&
			this.enabledTools.includes("search_grounding")
		) {
			this.tools.push(
				this.buildTool(ANTHROPIC_TOOL_TYPES.webSearch, "web_search", { max_uses: 3 }),
			);
		}
	}

	private addCodeExecution() {
		if (this.modelConfig.supportsCodeExecution && this.enabledTools.includes("code_execution")) {
			this.tools.push(this.buildTool(ANTHROPIC_TOOL_TYPES.codeExecution, "code_execution", {}));
		}
	}

	private addWebFetch() {
		if (this.modelConfig.supportsWebFetch && this.enabledTools.includes("web_fetch")) {
			this.tools.push(
				this.buildTool(ANTHROPIC_TOOL_TYPES.webFetch, "web_fetch", {
					max_uses: 5,
					citations: { enabled: true },
				}),
			);
		}
	}

	private buildTool(
		type: (typeof ANTHROPIC_TOOL_TYPES)[keyof typeof ANTHROPIC_TOOL_TYPES],
		name: string,
		defaults: Record<string, any>,
	): Record<string, any> {
		const { name: _name, type: _type, ...toolOptions } = readRecordOption(this.options, name);
		return {
			type,
			name,
			...defaults,
			...toolOptions,
		};
	}
}

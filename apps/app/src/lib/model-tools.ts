import type { ModelConfigItem } from "@assistant/schemas";

export type ModelToolId =
	| "code_execution"
	| "file_search"
	| "search_grounding"
	| "image_generation"
	| "mcp"
	| "web_fetch"
	| "tool_search"
	| "hosted_shell";

export type ToolCapabilityKey =
	| "supportsCodeExecution"
	| "supportsFileSearch"
	| "supportsSearchGrounding"
	| "supportsMcp"
	| "supportsImageGenerationTool"
	| "supportsWebFetch"
	| "supportsToolSearch"
	| "supportsHostedShell";

export interface ModelToolDefinition {
	capability: ToolCapabilityKey;
	command: string;
	description: string;
	id: ModelToolId;
	label: string;
	requiresConfiguration?: boolean;
}

export interface ModelToolOption extends ModelToolDefinition {
	availabilityReason: string;
	available: boolean;
	requiredModelCapabilities: ToolCapabilityKey[];
}

export const MODEL_TOOL_DEFINITIONS: ModelToolDefinition[] = [
	{
		capability: "supportsCodeExecution",
		command: "code execution",
		description: "Let supported models run code tools.",
		id: "code_execution",
		label: "Code execution",
	},
	{
		capability: "supportsSearchGrounding",
		command: "search grounding",
		description: "Let supported models use search grounding.",
		id: "search_grounding",
		label: "Search grounding",
	},
	{
		capability: "supportsImageGenerationTool",
		command: "image generation",
		description: "Let supported models generate images as a response tool.",
		id: "image_generation",
		label: "Image generation",
	},
	{
		capability: "supportsFileSearch",
		command: "file search",
		description: "Let supported models search configured vector stores.",
		id: "file_search",
		label: "File search",
		requiresConfiguration: true,
	},
	{
		capability: "supportsMcp",
		command: "mcp",
		description: "Let supported models use configured remote MCP servers.",
		id: "mcp",
		label: "MCP",
		requiresConfiguration: true,
	},
	{
		capability: "supportsToolSearch",
		command: "tool search",
		description: "Let supported models search the app tool inventory.",
		id: "tool_search",
		label: "Tool search",
	},
	{
		capability: "supportsHostedShell",
		command: "hosted shell",
		description: "Let supported models use OpenAI hosted shell.",
		id: "hosted_shell",
		label: "Hosted shell",
	},
	{
		capability: "supportsWebFetch",
		command: "web fetch",
		description: "Let supported models fetch URLs present in the conversation.",
		id: "web_fetch",
		label: "Web fetch",
	},
];

const MODEL_TOOL_IDS = new Set<ModelToolId>(MODEL_TOOL_DEFINITIONS.map((tool) => tool.id));

export function isModelToolId(toolId: string): toolId is ModelToolId {
	return MODEL_TOOL_IDS.has(toolId as ModelToolId);
}

function unavailableModelToolReason(
	tool: ModelToolDefinition,
	model?: Partial<Pick<ModelConfigItem, "supportsToolCalls" | ToolCapabilityKey>>,
): string {
	if (!model) {
		return "Select a model to see tool support.";
	}

	if (!model.supportsToolCalls) {
		return "The selected model does not support tools.";
	}

	if (model[tool.capability] && tool.id === "mcp") {
		return "Configure MCP servers before enabling MCP.";
	}

	if (model[tool.capability] && tool.id === "file_search") {
		return "Configure vector stores before enabling file search.";
	}

	return `The selected model does not support ${tool.command}.`;
}

export function getModelToolOptions(
	model?: Partial<Pick<ModelConfigItem, "supportsToolCalls" | ToolCapabilityKey>>,
): ModelToolOption[] {
	return MODEL_TOOL_DEFINITIONS.map((tool) => {
		const available = Boolean(
			model?.supportsToolCalls && model[tool.capability] && !tool.requiresConfiguration,
		);
		return {
			...tool,
			available,
			requiredModelCapabilities: [tool.capability],
			availabilityReason: available
				? "Available for the selected model."
				: unavailableModelToolReason(tool, model),
		};
	});
}

export function getAvailableModelTools(
	model?: Partial<Pick<ModelConfigItem, "supportsToolCalls" | ToolCapabilityKey>>,
) {
	return getModelToolOptions(model).filter((tool) => tool.available);
}

export function filterUnavailableModelToolSelections(
	selectedTools: string[],
	model?: Partial<Pick<ModelConfigItem, "supportsToolCalls" | ToolCapabilityKey>>,
): string[] {
	if (!model) {
		return selectedTools;
	}

	const availableModelToolIds = new Set(getAvailableModelTools(model).map((tool) => tool.id));

	return selectedTools.filter(
		(toolId) => !isModelToolId(toolId) || availableModelToolIds.has(toolId),
	);
}

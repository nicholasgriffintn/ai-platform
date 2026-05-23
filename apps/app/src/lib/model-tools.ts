import type { ModelConfigItem } from "~/types";

export type ModelToolId =
	| "code_execution"
	| "search_grounding"
	| "image_generation"
	| "web_fetch"
	| "tool_search"
	| "hosted_shell";

type ToolCapabilityKey =
	| "supportsCodeExecution"
	| "supportsSearchGrounding"
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

export function getAvailableModelTools(
	model?: Pick<ModelConfigItem, ToolCapabilityKey>,
): ModelToolDefinition[] {
	if (!model) {
		return [];
	}

	return MODEL_TOOL_DEFINITIONS.filter((tool) => Boolean(model[tool.capability]));
}

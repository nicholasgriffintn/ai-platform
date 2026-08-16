import type {
	AppTheme,
	ProjectExperienceDefinition,
	ProjectExperienceRuntime,
	ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

export type AppKind = "dynamic" | "frontend";

/**
 * One entry per rich experience. Entries with a `capabilityId` are also published as apps a
 * project or person can enable; entries without one are always available alongside them.
 */
export interface ExperienceDefinition {
	id: string;
	runtime: ProjectExperienceRuntime;
	name: string;
	description: string;
	category: string;
	icon?: string;
	theme?: AppTheme;
	tags?: string[];
	type?: "normal" | "premium" | "byok";
	capabilityId?: string;
	href?: string;
}

export const EXPERIENCES: ExperienceDefinition[] = [
	{
		id: "responses",
		runtime: "responses",
		name: "Saved outputs",
		description: "Review everything the enabled experiences and tools have produced.",
		category: "Results",
		icon: "puzzle",
		theme: "slate",
	},
	{
		id: "strudel",
		runtime: "strudel",
		capabilityId: "featured-strudel",
		name: "Strudel Music Patterns",
		description:
			"Create and generate music patterns with AI using Strudel's powerful code-based music creation tool",
		icon: "music",
		category: "AI Generation",
		theme: "indigo",
		tags: ["music", "audio", "generation"],
		href: "/apps/strudel",
		type: "normal",
	},
	{
		id: "replicate",
		runtime: "replicate",
		capabilityId: "featured-replicate",
		name: "Replicate Predictions",
		description: "Generate images, videos, audio, and more with state-of-the-art AI models",
		icon: "sparkles",
		category: "AI Generation",
		theme: "violet",
		tags: ["media", "multi-modal", "generation"],
		href: "/apps/replicate",
		type: "byok",
	},
	{
		id: "finetuning",
		runtime: "finetuning",
		capabilityId: "featured-finetuning",
		name: "Training",
		description: "Train, inspect, and deploy provider-backed models from the API model catalogue",
		icon: "hammer",
		category: "AI Operations",
		theme: "slate",
		tags: ["training", "models", "deployments"],
		href: "/apps/finetuning",
		type: "premium",
	},
	{
		id: "podcasts",
		runtime: "podcasts",
		capabilityId: "featured-podcast-processor",
		name: "Podcast Processor",
		description: "Upload and process your podcast to get transcription, summary, and cover image",
		icon: "mic",
		category: "Media",
		theme: "emerald",
		tags: ["audio", "workflow"],
		href: "/apps/podcasts",
		type: "premium",
	},
	{
		id: "articles",
		runtime: "articles",
		capabilityId: "featured-article-processor",
		name: "Article Processor",
		description: "Analyse and summarise articles to get insights and summaries",
		icon: "newspaper",
		category: "Text",
		theme: "cyan",
		tags: ["analysis", "summarisation"],
		href: "/apps/articles",
		type: "premium",
	},
	{
		id: "notes",
		runtime: "notes",
		capabilityId: "featured-note-taker",
		name: "Note Taker",
		description: "Take notes and save them for later",
		icon: "notebook-pen",
		category: "Productivity",
		theme: "amber",
		tags: ["notes", "workspace"],
		href: "/apps/notes",
		type: "premium",
	},
];

export const MODEL_TOOL_DEFINITIONS: ModelToolDefinition[] = [
	{
		capability: "supportsCodeExecution",
		category: "Development",
		command: "code execution",
		description: "Let supported models run code tools.",
		id: "code_execution",
		label: "Code execution",
	},
	{
		capability: "supportsSearchGrounding",
		category: "Research",
		command: "search grounding",
		description: "Let supported models use search grounding.",
		id: "search_grounding",
		label: "Search grounding",
	},
	{
		capability: "supportsImageGenerationTool",
		category: "Media",
		command: "image generation",
		description: "Let supported models generate images as a response tool.",
		id: "image_generation",
		label: "Image generation",
	},
	{
		capability: "supportsFileSearch",
		category: "Knowledge",
		command: "file search",
		description: "Let supported models search configured vector stores.",
		id: "file_search",
		label: "File search",
		requiresConfiguration: true,
		configurationKind: "file_search",
	},
	{
		capability: "supportsMcp",
		category: "Integrations",
		command: "mcp",
		description: "Let supported models use configured remote MCP servers.",
		id: "mcp",
		label: "MCP",
		requiresConfiguration: true,
		configurationKind: "mcp",
	},
	{
		capability: "supportsToolSearch",
		category: "Utilities",
		command: "tool search",
		description: "Let supported models search the app tool inventory.",
		id: "tool_search",
		label: "Tool search",
	},
	{
		capability: "supportsHostedShell",
		category: "Development",
		command: "hosted shell",
		description: "Let supported models use OpenAI hosted shell.",
		id: "hosted_shell",
		label: "Hosted shell",
	},
	{
		capability: "supportsWebFetch",
		category: "Research",
		command: "web fetch",
		description: "Let supported models fetch URLs present in the conversation.",
		id: "web_fetch",
		label: "Web fetch",
	},
];

export const getExperienceCatalog = (): ExperienceDefinition[] => EXPERIENCES;

export const getProjectExperienceCatalog = (): ProjectExperienceDefinition[] =>
	EXPERIENCES.map(
		({
			id,
			runtime,
			name,
			description,
			icon,
			category,
			theme,
			tags,
			type,
			href,
			capabilityId,
		}) => ({
			id,
			runtime,
			name,
			description,
			icon,
			category,
			theme,
			tags,
			type,
			href,
			requirement: capabilityId
				? { kind: "capability" as const, capabilityKind: "app" as const, capabilityId }
				: { kind: "capability_kind" as const, capabilityKind: "app" as const },
		}),
	);

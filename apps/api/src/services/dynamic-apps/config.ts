import type {
	AppTheme,
	ProjectExperienceDefinition,
	ProjectExperienceRuntime,
	ProjectToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

type DynamicAppCategory =
	| "Agents & Delegation"
	| "Research & Retrieval"
	| "Content Generation"
	| "Code Assistance"
	| "Productivity & Coaching"
	| "Data & Utilities"
	| "OCR"
	| "System & Meta"
	| "Connectors";

export type AppKind = "dynamic" | "frontend";

export interface DynamicAppMetadata {
	category: DynamicAppCategory;
	icon?: string;
	theme?: AppTheme;
	tags?: string[];
	featured?: boolean;
}

export interface FeaturedAppDefinition {
	id: string;
	name: string;
	description: string;
	category: string;
	icon?: string;
	theme?: AppTheme;
	tags?: string[];
	type?: "normal" | "premium" | "byok";
	href: string;
	kind?: AppKind;
	experience?: {
		id: string;
		runtime: ProjectExperienceRuntime;
	};
}

export type FeaturedAppCatalogDefinition = Omit<FeaturedAppDefinition, "experience">;

export const FUNCTION_APP_METADATA: Record<string, DynamicAppMetadata> = {
	add_reasoning_step: {
		category: "Agents & Delegation",
		icon: "brain-circuit",
		theme: "violet",
		tags: ["agents", "reasoning", "workflow"],
	},
	delegate_to_team_member: {
		category: "Agents & Delegation",
		icon: "users",
		theme: "violet",
		tags: ["agents", "delegation"],
	},
	delegate_to_team_member_by_role: {
		category: "Agents & Delegation",
		icon: "user-cog",
		theme: "violet",
		tags: ["agents", "delegation"],
	},
	get_team_members: {
		category: "Agents & Delegation",
		icon: "users-round",
		theme: "violet",
		tags: ["agents", "directory"],
	},
	extract_content: {
		category: "Research & Retrieval",
		icon: "file-search",
		theme: "cyan",
		tags: ["retrieval", "content"],
	},
	analyse_hacker_news: {
		category: "Research & Retrieval",
		icon: "newspaper",
		theme: "cyan",
		tags: ["analysis", "news"],
	},
	web_search: {
		category: "Research & Retrieval",
		icon: "search",
		theme: "cyan",
		tags: ["search", "information"],
	},
	research: {
		category: "Research & Retrieval",
		icon: "book-open",
		theme: "cyan",
		tags: ["research", "analysis"],
	},
	get_weather: {
		category: "Data & Utilities",
		icon: "cloud-sun",
		theme: "sky",
		tags: ["weather", "forecast"],
	},
	capture_screenshot: {
		category: "Content Generation",
		icon: "camera",
		theme: "amber",
		tags: ["visual", "capture"],
	},
	create_image: {
		category: "Content Generation",
		icon: "image",
		theme: "pink",
		tags: ["visual", "generation"],
	},
	create_video: {
		category: "Content Generation",
		icon: "clapperboard",
		theme: "rose",
		tags: ["video", "generation"],
	},
	create_music: {
		category: "Content Generation",
		icon: "music",
		theme: "indigo",
		tags: ["audio", "generation"],
	},
	create_speech: {
		category: "Content Generation",
		icon: "mic",
		theme: "emerald",
		tags: ["audio", "speech"],
	},
	fill_in_middle_completion: {
		category: "Code Assistance",
		icon: "braces",
		theme: "slate",
		tags: ["code", "completion"],
	},
	next_edit_completion: {
		category: "Code Assistance",
		icon: "code-2",
		theme: "slate",
		tags: ["code", "editing"],
	},
	apply_edit_completion: {
		category: "Code Assistance",
		icon: "wand-2",
		theme: "slate",
		tags: ["code", "editing"],
	},
	v0_code_generation: {
		category: "Code Assistance",
		icon: "binary",
		theme: "slate",
		tags: ["code", "generation"],
	},
	run_feature_implementation: {
		category: "Code Assistance",
		icon: "hammer",
		theme: "slate",
		tags: ["sandbox", "github", "automation"],
	},
	run_code_review: {
		category: "Code Assistance",
		icon: "search-check",
		theme: "slate",
		tags: ["sandbox", "github", "review"],
	},
	run_test_suite: {
		category: "Code Assistance",
		icon: "flask-conical",
		theme: "slate",
		tags: ["sandbox", "github", "tests"],
	},
	run_bug_fix: {
		category: "Code Assistance",
		icon: "bug",
		theme: "slate",
		tags: ["sandbox", "github", "bug-fix"],
	},
	prompt_coach: {
		category: "Productivity & Coaching",
		icon: "sparkles",
		theme: "violet",
		tags: ["prompting", "coaching"],
	},
	tutor: {
		category: "Productivity & Coaching",
		icon: "graduation-cap",
		theme: "emerald",
		tags: ["learning", "guidance"],
	},
	extract_text_from_document: {
		category: "OCR",
		icon: "document-text",
		theme: "blue",
		tags: ["document", "extraction"],
	},
	call_api: {
		category: "System & Meta",
		icon: "server-cog",
		theme: "slate",
		tags: ["api", "integration"],
	},
	search_functions: {
		category: "System & Meta",
		icon: "search-code",
		theme: "slate",
		tags: ["discovery", "system", "meta"],
	},
	get_function_schema: {
		category: "System & Meta",
		icon: "file-json",
		theme: "slate",
		tags: ["schema", "system", "meta"],
	},
	retry_with_backoff: {
		category: "System & Meta",
		icon: "refresh-cw",
		theme: "amber",
		tags: ["error-recovery", "retry", "reliability"],
	},
	fallback: {
		category: "System & Meta",
		icon: "shield-check",
		theme: "emerald",
		tags: ["error-recovery", "fallback", "reliability"],
	},
	request_approval: {
		category: "System & Meta",
		icon: "check-circle",
		theme: "blue",
		tags: ["human-in-the-loop", "approval", "workflow"],
	},
	ask_user: {
		category: "System & Meta",
		icon: "message-circle-question",
		theme: "cyan",
		tags: ["human-in-the-loop", "input", "interactive"],
	},
	compose_functions: {
		category: "System & Meta",
		icon: "layers",
		theme: "slate",
		tags: ["workflow", "composition", "system"],
	},
	if_then_else: {
		category: "System & Meta",
		icon: "branch",
		theme: "slate",
		tags: ["workflow", "logic", "system"],
	},
	parallel_execute: {
		category: "System & Meta",
		icon: "shuffle",
		theme: "slate",
		tags: ["workflow", "parallelism", "system"],
	},
	configure_recipe: {
		category: "System & Meta",
		icon: "wrench",
		theme: "slate",
		tags: ["workflow", "configuration", "system"],
	},
	create_note: {
		category: "System & Meta",
		icon: "notebook",
		theme: "amber",
		tags: ["note-taking", "system", "meta"],
	},
	get_note: {
		category: "System & Meta",
		icon: "notebook-search",
		theme: "amber",
		tags: ["note-taking", "system", "meta"],
	},
	create_qr_code: {
		category: "Content Generation",
		icon: "qr-code",
		theme: "emerald",
		tags: ["qr", "generation"],
	},
	get_recipe: {
		category: "System & Meta",
		icon: "book-open",
		theme: "slate",
		tags: ["workflow", "recipe", "system"],
	},
	run_documentation: {
		category: "Code Assistance",
		icon: "book",
		theme: "slate",
		tags: ["sandbox", "github", "documentation"],
	},
	run_migration: {
		category: "Code Assistance",
		icon: "arrow-right-square",
		theme: "slate",
		tags: ["sandbox", "github", "migration"],
	},
	run_refactoring: {
		category: "Code Assistance",
		icon: "arrows-maximize",
		theme: "slate",
		tags: ["sandbox", "github", "refactoring"],
	},
	run_pashi_tools: {
		category: "Code Assistance",
		icon: "terminal",
		theme: "slate",
		tags: ["sandbox", "pashi", "tools"],
	},
	search_pashi_tools: {
		category: "Code Assistance",
		icon: "search",
		theme: "slate",
		tags: ["sandbox", "pashi", "search"],
	},
	search_memories: {
		category: "System & Meta",
		icon: "search",
		theme: "slate",
		tags: ["memory", "search", "system"],
	},
	store_memory: {
		category: "System & Meta",
		icon: "database",
		theme: "slate",
		tags: ["memory", "storage", "system"],
	},
	trigger_recipe: {
		category: "System & Meta",
		icon: "play",
		theme: "slate",
		tags: ["workflow", "trigger", "system"],
	},
	use_recipe_connector: {
		category: "System & Meta",
		icon: "plug",
		theme: "slate",
		tags: ["workflow", "connector", "system"],
	},
};

export const FEATURED_APPS: FeaturedAppDefinition[] = [
	{
		id: "featured-strudel",
		name: "Strudel Music Patterns",
		description:
			"Create and generate music patterns with AI using Strudel's powerful code-based music creation tool",
		icon: "music",
		category: "AI Generation",
		theme: "indigo",
		tags: ["music", "audio", "generation"],
		href: "/apps/strudel",
		type: "normal",
		kind: "frontend",
		experience: { id: "strudel", runtime: "strudel" },
	},
	{
		id: "featured-replicate",
		name: "Replicate Predictions",
		description: "Generate images, videos, audio, and more with state-of-the-art AI models",
		icon: "sparkles",
		category: "AI Generation",
		theme: "violet",
		tags: ["media", "multi-modal", "generation"],
		href: "/apps/replicate",
		type: "byok",
		kind: "frontend",
		experience: { id: "replicate", runtime: "replicate" },
	},
	{
		id: "featured-finetuning",
		name: "Training",
		description: "Train, inspect, and deploy provider-backed models from the API model catalogue",
		icon: "hammer",
		category: "AI Operations",
		theme: "slate",
		tags: ["training", "models", "deployments"],
		href: "/apps/finetuning",
		type: "premium",
		kind: "frontend",
		experience: { id: "finetuning", runtime: "finetuning" },
	},
	{
		id: "featured-podcast-processor",
		name: "Podcast Processor",
		description: "Upload and process your podcast to get transcription, summary, and cover image",
		icon: "mic",
		category: "Media",
		theme: "emerald",
		tags: ["audio", "workflow"],
		href: "/apps/podcasts",
		type: "premium",
		kind: "frontend",
		experience: { id: "podcasts", runtime: "podcasts" },
	},
	{
		id: "featured-article-processor",
		name: "Article Processor",
		description: "Analyse and summarise articles to get insights and summaries",
		icon: "newspaper",
		category: "Text",
		theme: "cyan",
		tags: ["analysis", "summarisation"],
		href: "/apps/articles",
		type: "premium",
		kind: "frontend",
		experience: { id: "articles", runtime: "articles" },
	},
	{
		id: "featured-note-taker",
		name: "Note Taker",
		description: "Take notes and save them for later",
		icon: "notebook-pen",
		category: "Productivity",
		theme: "amber",
		tags: ["notes", "workspace"],
		href: "/apps/notes",
		type: "premium",
		kind: "frontend",
		experience: { id: "notes", runtime: "notes" },
	},
];

const PROJECT_EXPERIENCE_MANAGERS: ProjectExperienceDefinition[] = [
	{
		id: "responses",
		runtime: "responses",
		name: "Saved Dynamic App Responses",
		description: "Review saved outputs from the project's form-backed apps.",
		category: "Results",
		icon: "puzzle",
		theme: "slate",
		requirement: {
			kind: "capability_kind",
			capabilityKind: "app",
			appKind: "dynamic",
		},
	},
];

export const PROJECT_TOOL_DEFINITIONS: ProjectToolDefinition[] = [
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

export const getFunctionMetadata = (name: string): DynamicAppMetadata | undefined => {
	if (name.startsWith("connector_")) {
		return {
			category: "Connectors",
			icon: "server-cog",
			theme: "slate",
			tags: ["connector", "integration"],
		};
	}

	const functionMetadata = FUNCTION_APP_METADATA[name];

	if (!functionMetadata) {
		console.warn(`No metadata found for function "${name}"`);
	}

	return FUNCTION_APP_METADATA[name];
};

export const getFeaturedApps = (): FeaturedAppCatalogDefinition[] =>
	FEATURED_APPS.map(({ experience: _experience, ...app }) => app);

export const getProjectExperienceCatalog = (): ProjectExperienceDefinition[] => [
	...FEATURED_APPS.flatMap((app) =>
		app.experience
			? [
					{
						id: app.experience.id,
						runtime: app.experience.runtime,
						name: app.name,
						description: app.description,
						icon: app.icon,
						category: app.category,
						theme: app.theme,
						requirement: {
							kind: "capability" as const,
							capabilityKind: "app" as const,
							capabilityId: app.id,
						},
					},
				]
			: [],
	),
	...PROJECT_EXPERIENCE_MANAGERS,
];

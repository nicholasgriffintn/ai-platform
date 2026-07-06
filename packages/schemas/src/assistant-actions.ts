import z from "zod/v4";

import {
	assistantCapabilityDescriptorSchema,
	type AssistantCapabilityDescriptor,
	type AssistantRecipe,
	createRecipeChatRequestOptions,
	type DynamicAppCatalogItem,
	recipeChatRequestOptionsSchema,
	recipeConnectorProviderSchema,
	type RecipeConnectorManifest,
	type RecipeChatSetupResponse,
	type RecipeInstallation,
} from "./apps";
import { partialChatCompletionsJsonSchema } from "./chat";
import { mergeToolIds, normaliseToolIds } from "./tool-ids";
import { toolIdsSchema, toolIdSchema } from "./tools";

export const assistantActionVerbIdSchema = z.enum([
	"run",
	"setup",
	"connect",
	"open",
	"schedule",
	"ask",
	"use",
]);

export const assistantActionItemKindSchema = z.enum([
	"agent",
	"app",
	"connector",
	"installed_recipe",
	"recipe",
	"tool",
]);

export const assistantActionVerbSchema = z.object({
	id: assistantActionVerbIdSchema,
	command: assistantActionVerbIdSchema,
	label: z.string(),
	description: z.string(),
});

export const assistantActionItemMetadataSchema = z.object({
	agentId: z.string().optional(),
	appId: z.string().optional(),
	appKind: z.enum(["dynamic", "frontend"]).optional(),
	authType: z.enum(["oauth2", "github_app", "api_key"]).optional(),
	href: z.string().optional(),
	installationId: z.string().optional(),
	provider: recipeConnectorProviderSchema.optional(),
	recipeId: z.string().optional(),
	toolId: z.string().optional(),
});

export const assistantActionConversationLaunchSchema = z.object({
	kind: z.literal("conversation"),
	operation: z.enum(["ask_agent", "install_recipe", "invoke_recipe"]),
	agentId: z.string().optional(),
	installationId: z.string().optional(),
	recipeId: z.string().optional(),
});

export const assistantActionNavigationLaunchSchema = z.object({
	kind: z.literal("navigation"),
	path: z.string(),
});

export const assistantActionExternalLaunchSchema = z.object({
	kind: z.literal("external"),
	authType: z.enum(["oauth2", "github_app"]).optional(),
	provider: recipeConnectorProviderSchema.optional(),
	url: z.string().optional(),
});

export const assistantActionToolToggleLaunchSchema = z.object({
	kind: z.literal("tool_toggle"),
	toolId: toolIdSchema,
});

export const assistantActionScheduleLaunchSchema = z.object({
	kind: z.literal("schedule"),
	recipeId: z.string(),
});

export const assistantActionLaunchSchema = z.discriminatedUnion("kind", [
	assistantActionConversationLaunchSchema,
	assistantActionExternalLaunchSchema,
	assistantActionNavigationLaunchSchema,
	assistantActionScheduleLaunchSchema,
	assistantActionToolToggleLaunchSchema,
]);

export const assistantActionItemSchema = z.object({
	id: z.string(),
	kind: assistantActionItemKindSchema,
	label: z.string(),
	capability: assistantCapabilityDescriptorSchema,
	description: z.string().optional(),
	status: z.string().optional(),
	searchText: z.array(z.string()),
	launch: assistantActionLaunchSchema,
	metadata: assistantActionItemMetadataSchema.optional(),
});

export const assistantActionCatalogSchema = z.object({
	verbs: z.array(assistantActionVerbSchema),
	items: z.array(assistantActionItemSchema),
});

export const assistantActionSelectionItemSchema = z.object({
	id: z.string(),
	kind: assistantActionItemKindSchema,
	label: z.string(),
	launch: assistantActionLaunchSchema.optional(),
	metadata: assistantActionItemMetadataSchema.optional(),
});

export const assistantActionSelectionSchema = z.object({
	verb: assistantActionVerbIdSchema.optional(),
	item: assistantActionSelectionItemSchema.optional(),
	tokenPosition: z.number().optional(),
});

export const assistantRecipeActionContextSchema = z.object({
	kind: z.literal("recipe"),
	recipe: recipeChatRequestOptionsSchema,
});

export const assistantActionContextPayloadSchema = z.object({
	action: assistantRecipeActionContextSchema,
});

export const assistantLegacyRecipeContextPayloadSchema = z.object({
	recipe: recipeChatRequestOptionsSchema,
});

export const assistantActionDeliverySchema = z.enum(["conversation", "submit"]);

export const assistantActionNotificationSchema = z.object({
	message: z.string(),
	type: z.literal("error"),
});

export const assistantActionToolIdSchema = toolIdSchema;
export const assistantActionToolIdsSchema = toolIdsSchema;

const assistantActionResultBaseSchema = z.object({
	input: z.string(),
	notification: assistantActionNotificationSchema.optional(),
	selectedTools: assistantActionToolIdsSchema.optional(),
});

export const assistantActionSubmitResultSchema = assistantActionResultBaseSchema.extend({
	kind: z.literal("submit"),
	requestOptions: partialChatCompletionsJsonSchema.optional(),
});

export const assistantActionConversationResultSchema = assistantActionResultBaseSchema.extend({
	kind: z.literal("conversation"),
	requestOptions: partialChatCompletionsJsonSchema.optional(),
	url: z.string(),
});

export const assistantActionNavigationResultSchema = assistantActionResultBaseSchema.extend({
	kind: z.literal("navigation"),
	path: z.string(),
});

export const assistantActionExternalResultSchema = assistantActionResultBaseSchema.extend({
	kind: z.literal("external"),
	url: z.string(),
});

export const assistantActionResultSchema = z.discriminatedUnion("kind", [
	assistantActionConversationResultSchema,
	assistantActionExternalResultSchema,
	assistantActionNavigationResultSchema,
	assistantActionSubmitResultSchema,
]);

export const assistantActionVerbs = [
	{
		id: "run",
		command: "run",
		label: "Run",
		description: "Run an installed recipe, app, agent, or tool-backed action.",
	},
	{
		id: "setup",
		command: "setup",
		label: "Set up",
		description: "Configure a recipe, app, connector, or assistant workflow.",
	},
	{
		id: "connect",
		command: "connect",
		label: "Connect",
		description: "Connect an external provider or installation.",
	},
	{
		id: "open",
		command: "open",
		label: "Open",
		description: "Open an app, recipe, connector, or saved assistant surface.",
	},
	{
		id: "schedule",
		command: "schedule",
		label: "Schedule",
		description: "Schedule a recipe or automation.",
	},
	{
		id: "ask",
		command: "ask",
		label: "Ask",
		description: "Ask an agent or selected assistant context.",
	},
	{
		id: "use",
		command: "use",
		label: "Use",
		description: "Use a tool, connector, or capability in this conversation.",
	},
] satisfies AssistantActionVerb[];

export interface AssistantActionAgentSource {
	id: string;
	name: string;
	description?: string;
	model?: string;
}

export interface AssistantActionModelToolDefinition {
	availabilityReason?: string;
	available?: boolean;
	command: string;
	description: string;
	id: string;
	label: string;
	operationAccess?: AssistantCapabilityDescriptor["operationAccess"];
	requiredModelCapabilities?: readonly string[];
}

export interface AssistantActionCatalogSources {
	agents?: readonly AssistantActionAgentSource[];
	apps?: readonly DynamicAppCatalogItem[];
	connectors?: readonly RecipeConnectorManifest[];
	installations?: readonly RecipeInstallation[];
	modelTools?: readonly AssistantActionModelToolDefinition[];
	recipes?: readonly AssistantRecipe[];
}

function nonEmptyText(value: string | undefined): string[] {
	const trimmed = value?.trim();
	return trimmed ? [trimmed] : [];
}

function buildInstalledRecipeItems(
	recipes: readonly AssistantRecipe[],
	installations: readonly RecipeInstallation[],
): AssistantActionItem[] {
	const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

	return installations.filter(isActiveRecipeInstallation).flatMap((installation) => {
		const recipe = recipeById.get(installation.recipeId);
		if (!recipe) {
			return [];
		}

		return [createRecipeAssistantActionItem(recipe, installation)];
	});
}

function isActiveRecipeInstallation(installation: RecipeInstallation): boolean {
	return installation.status === "active";
}

function isConnectedRecipeConnector(connector: RecipeConnectorManifest): boolean {
	return connector.status === "connected";
}

function getApprovalPolicy(
	operationAccess: AssistantCapabilityDescriptor["operationAccess"],
): AssistantCapabilityDescriptor["approvalPolicy"] {
	return operationAccess === "write" || operationAccess === "mixed" ? "on_write" : "never";
}

function getHostedToolModelCapabilities(toolId: string): string[] {
	switch (toolId) {
		case "code_execution":
			return ["supportsCodeExecution"];
		case "file_search":
			return ["supportsFileSearch"];
		case "hosted_shell":
			return ["supportsHostedShell"];
		case "image_generation":
			return ["supportsImageGenerationTool"];
		case "mcp":
			return ["supportsMcp"];
		case "search_grounding":
			return ["supportsSearchGrounding"];
		case "tool_search":
			return ["supportsToolSearch"];
		case "web_fetch":
			return ["supportsWebFetch"];
		default:
			return [];
	}
}

function createRecipeCapabilityDescriptor(
	recipe: AssistantRecipe,
	installation?: RecipeInstallation,
): AssistantCapabilityDescriptor {
	return {
		...(recipe.capability ?? {
			id: recipe.id,
			kind: "recipe",
			name: recipe.title,
			description: recipe.summary,
			availability: "available",
			launch: {
				method: "conversation",
				action: "recipe_chat",
			},
			executionMode: "workflow",
			authRequirement: "pro",
			requiredModelCapabilities: [],
			requiredConnectors: [],
			savedState: {
				supported: true,
				kind: "installation",
			},
			tags: [recipe.category, recipe.kind],
		}),
		availability: installation ? "installed" : (recipe.capability?.availability ?? "available"),
		authState: "pro_required",
		operationAccess: "mixed",
		approvalPolicy: "on_write",
		requiredConnectors: recipe.integrations
			.filter((integration) => integration.requiresConnection !== false)
			.map((integration) => ({
				provider: integration.providerId,
				state: integration.connectionStatus ?? "unknown",
			})),
		availabilityReason: installation
			? "Recipe is installed and active."
			: "Recipe can be installed.",
	};
}

function createAppCapabilityDescriptor(app: DynamicAppCatalogItem): AssistantCapabilityDescriptor {
	if (app.capability) {
		return {
			...app.capability,
			authState: app.capability.authState ?? "not_required",
			approvalPolicy: app.capability.approvalPolicy ?? "never",
			requiredModelCapabilities: app.capability.requiredModelCapabilities ?? [],
			requiredConnectors: app.capability.requiredConnectors ?? [],
			availabilityReason: app.capability.availabilityReason ?? "Available.",
		};
	}

	const kind = app.kind ?? (app.href ? "frontend" : "dynamic");
	return {
		id: app.id,
		kind: kind === "frontend" ? "frontend_app" : "dynamic_app",
		name: app.name,
		description: app.description,
		availability: "available",
		launch: {
			method: kind === "frontend" ? "navigation" : "form",
			href: app.href,
		},
		executionMode: kind === "frontend" ? "navigation" : "function",
		authRequirement: "none",
		authState: "not_required",
		operationAccess: "read",
		approvalPolicy: "never",
		requiredModelCapabilities: [],
		requiredConnectors: [],
		availabilityReason: "Available.",
		savedState:
			kind === "frontend"
				? {
						supported: false,
					}
				: {
						supported: true,
						kind: "stored_response",
					},
		tags: app.tags ?? [],
	};
}

function createAgentCapabilityDescriptor(
	agent: AssistantActionAgentSource,
): AssistantCapabilityDescriptor {
	return {
		id: agent.id,
		kind: "agent",
		name: agent.name,
		description: agent.description,
		availability: "available",
		launch: {
			method: "conversation",
			action: "ask_agent",
		},
		executionMode: "agent",
		authRequirement: "signed_in",
		authState: "unknown",
		operationAccess: "mixed",
		approvalPolicy: "on_write",
		requiredModelCapabilities: [],
		requiredConnectors: [],
		availabilityReason: "Agent is available.",
		savedState: {
			supported: true,
		},
		tags: [],
	};
}

function createConnectorCapabilityDescriptor(
	connector: RecipeConnectorManifest,
): AssistantCapabilityDescriptor {
	const operationAccess = connector.operationAccess ?? "mixed";
	return {
		id: connector.id,
		kind: "connector",
		name: connector.name,
		description: connector.description,
		availability: connector.status === "connected" ? "connected" : connector.status,
		launch: {
			method: connector.authType === "api_key" ? "navigation" : "external",
			href: connector.setupUrl,
		},
		executionMode: "connector_operation",
		authRequirement: "connector",
		authState: connector.status,
		operationAccess,
		approvalPolicy: getApprovalPolicy(operationAccess),
		requiredModelCapabilities: [],
		requiredConnectors: [
			{
				provider: connector.id,
				state: connector.status,
			},
		],
		availabilityReason:
			connector.status === "connected"
				? `${connector.name} is connected.`
				: `${connector.name} is ${connector.status}.`,
		savedState: {
			supported: true,
			kind: "connection",
		},
		tags: ["connector", connector.authType],
	};
}

function createToolCapabilityDescriptor(
	tool: AssistantActionModelToolDefinition,
): AssistantCapabilityDescriptor {
	const operationAccess = tool.operationAccess ?? "read";
	return {
		id: tool.id,
		kind: "tool",
		name: tool.label,
		description: tool.description,
		availability: tool.available === false ? "unavailable" : "available",
		launch: {
			method: "tool_toggle",
			action: tool.id,
		},
		executionMode: "tool",
		authRequirement: "none",
		authState: "not_required",
		operationAccess,
		approvalPolicy: getApprovalPolicy(operationAccess),
		requiredModelCapabilities: [
			...(tool.requiredModelCapabilities ?? getHostedToolModelCapabilities(tool.id)),
		],
		requiredConnectors: [],
		availabilityReason:
			tool.availabilityReason ??
			(tool.available === false
				? "Not available for the selected model."
				: "Available for the selected model."),
		savedState: {
			supported: false,
		},
		tags: ["tool"],
	};
}

export function createRecipeAssistantActionItem(
	recipe: AssistantRecipe,
	installation?: RecipeInstallation,
): AssistantActionItem {
	return {
		id: installation ? `installed_recipe:${installation.id}` : `recipe:${recipe.id}`,
		kind: installation ? "installed_recipe" : "recipe",
		label: recipe.title,
		description: recipe.summary,
		status: installation?.status ?? "available",
		searchText: [
			recipe.title,
			recipe.summary,
			recipe.description,
			recipe.category,
			...recipe.actions,
		],
		launch: {
			kind: "conversation",
			operation: installation ? "invoke_recipe" : "install_recipe",
			recipeId: recipe.id,
			...(installation ? { installationId: installation.id } : {}),
		},
		capability: createRecipeCapabilityDescriptor(recipe, installation),
		metadata: {
			recipeId: recipe.id,
			installationId: installation?.id,
		},
	};
}

export function createConnectorAssistantActionItem(
	connector: RecipeConnectorManifest,
): AssistantActionItem {
	return {
		id: `connector:${connector.id}`,
		kind: "connector",
		label: connector.name,
		description: connector.description,
		status: connector.status,
		searchText: [
			connector.name,
			connector.description,
			connector.id,
			connector.status,
			...connector.operations,
		],
		launch:
			connector.authType === "api_key"
				? {
						kind: "navigation",
						path: `/profile?tab=providers&type=connector&connector=${connector.id}`,
					}
				: {
						kind: "external",
						authType: connector.authType,
						provider: connector.id,
					},
		capability: createConnectorCapabilityDescriptor(connector),
		metadata: {
			authType: connector.authType,
			provider: connector.id,
		},
	};
}

export function buildAssistantActionCatalog(
	sources: AssistantActionCatalogSources,
): AssistantActionCatalog {
	const recipes = sources.recipes ?? [];
	const installations = sources.installations ?? [];

	return {
		verbs: assistantActionVerbs,
		items: [
			...buildInstalledRecipeItems(recipes, installations),
			...(sources.apps ?? []).map((app) => ({
				id: `app:${app.id}`,
				kind: "app" as const,
				label: app.name,
				capability: createAppCapabilityDescriptor(app),
				description: app.description,
				status: app.type,
				searchText: [
					app.name,
					...nonEmptyText(app.description),
					...nonEmptyText(app.category),
					...(app.tags ?? []),
				],
				launch: {
					kind: "navigation" as const,
					path:
						app.kind === "frontend" && app.href
							? app.href
							: `/apps?app=${encodeURIComponent(app.id)}`,
				},
				metadata: {
					appId: app.id,
					appKind: app.kind,
					href: app.href,
				},
			})),
			...(sources.agents ?? []).map((agent) => ({
				id: `agent:${agent.id}`,
				kind: "agent" as const,
				label: agent.name,
				capability: createAgentCapabilityDescriptor(agent),
				description: agent.description,
				status: agent.model,
				searchText: [agent.name, ...nonEmptyText(agent.description), ...nonEmptyText(agent.model)],
				launch: {
					kind: "conversation" as const,
					operation: "ask_agent" as const,
					agentId: agent.id,
				},
				metadata: {
					agentId: agent.id,
				},
			})),
			...(sources.connectors ?? [])
				.filter(isConnectedRecipeConnector)
				.map((connector) => createConnectorAssistantActionItem(connector)),
			...(sources.modelTools ?? []).map((tool) => ({
				id: `tool:${tool.id}`,
				kind: "tool" as const,
				label: tool.label,
				capability: createToolCapabilityDescriptor(tool),
				description: tool.description,
				searchText: [tool.label, tool.command, tool.description, tool.id],
				launch: {
					kind: "tool_toggle" as const,
					toolId: tool.id,
				},
				metadata: {
					toolId: tool.id,
				},
			})),
		],
	};
}

export function formatAssistantActionMention(item: Pick<AssistantActionItem, "label">): string {
	return `@${item.label}`;
}

export function normaliseAssistantActionToolIds(value: string | string[] | undefined): string[] {
	return normaliseToolIds(value);
}

export function mergeAssistantActionToolIds(currentTools: string[], toolId: string): string[] {
	return mergeToolIds(currentTools, toolId);
}

export function createAssistantRecipeActionContext(
	response: RecipeChatSetupResponse,
): AssistantActionContextPayload {
	return {
		action: {
			kind: "recipe",
			recipe: createRecipeChatRequestOptions(response),
		},
	};
}

export function readAssistantActionRequestOptions(
	actionContext: unknown,
	legacyRecipeContext?: unknown,
): AssistantActionSubmitResult["requestOptions"] {
	const actionPayload = assistantActionContextPayloadSchema.safeParse(actionContext);
	if (actionPayload.success) {
		return { options: { recipe: actionPayload.data.action.recipe } };
	}

	const legacyRecipePayload =
		assistantLegacyRecipeContextPayloadSchema.safeParse(legacyRecipeContext);
	return legacyRecipePayload.success
		? { options: { recipe: legacyRecipePayload.data.recipe } }
		: undefined;
}

export type AssistantActionVerbId = z.infer<typeof assistantActionVerbIdSchema>;
export type AssistantActionItemKind = z.infer<typeof assistantActionItemKindSchema>;
export type AssistantActionLaunch = z.infer<typeof assistantActionLaunchSchema>;
export type AssistantActionVerb = z.infer<typeof assistantActionVerbSchema>;
export type AssistantActionItemMetadata = z.infer<typeof assistantActionItemMetadataSchema>;
export type AssistantActionItem = z.infer<typeof assistantActionItemSchema>;
export type AssistantActionCatalog = z.infer<typeof assistantActionCatalogSchema>;
export type AssistantActionSelectionItem = z.infer<typeof assistantActionSelectionItemSchema>;
export type AssistantActionSelection = z.infer<typeof assistantActionSelectionSchema>;
export type AssistantRecipeActionContext = z.infer<typeof assistantRecipeActionContextSchema>;
export type AssistantActionContextPayload = z.infer<typeof assistantActionContextPayloadSchema>;
export type AssistantLegacyRecipeContextPayload = z.infer<
	typeof assistantLegacyRecipeContextPayloadSchema
>;
export type AssistantActionDelivery = z.infer<typeof assistantActionDeliverySchema>;
export type AssistantActionNotification = z.infer<typeof assistantActionNotificationSchema>;
export type AssistantActionToolId = z.infer<typeof assistantActionToolIdSchema>;
export type AssistantActionSubmitResult = z.input<typeof assistantActionSubmitResultSchema>;
export type AssistantActionConversationResult = z.input<
	typeof assistantActionConversationResultSchema
>;
export type AssistantActionNavigationResult = z.input<typeof assistantActionNavigationResultSchema>;
export type AssistantActionExternalResult = z.input<typeof assistantActionExternalResultSchema>;
export type AssistantActionResult = z.input<typeof assistantActionResultSchema>;

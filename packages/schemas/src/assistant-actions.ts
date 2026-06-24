import z from "zod/v4";

import {
	type AssistantRecipe,
	createRecipeChatRequestOptions,
	type DynamicAppCatalogItem,
	recipeChatRequestOptionsSchema,
	recipeConnectorProviderSchema,
	type RecipeConnectorManifest,
	type RecipeChatSetupResponse,
	type RecipeInstallation,
} from "./apps";
import { chatRequestOptionsSchema } from "./chat";
import { mergeToolIds, normaliseToolIds, toolIdsSchema, toolIdSchema } from "./tools";

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

export const assistantActionItemSchema = z.object({
	id: z.string(),
	kind: assistantActionItemKindSchema,
	label: z.string(),
	description: z.string().optional(),
	status: z.string().optional(),
	searchText: z.array(z.string()),
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
	requestOptions: chatRequestOptionsSchema.optional(),
});

export const assistantActionConversationResultSchema = assistantActionResultBaseSchema.extend({
	kind: z.literal("conversation"),
	requestOptions: chatRequestOptionsSchema.optional(),
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
	command: string;
	description: string;
	id: string;
	label: string;
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
				description: app.description,
				status: app.type,
				searchText: [
					app.name,
					...nonEmptyText(app.description),
					...nonEmptyText(app.category),
					...(app.tags ?? []),
				],
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
				description: agent.description,
				status: agent.model,
				searchText: [agent.name, ...nonEmptyText(agent.description), ...nonEmptyText(agent.model)],
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
				description: tool.description,
				searchText: [tool.label, tool.command, tool.description, tool.id],
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
		return { recipe: actionPayload.data.action.recipe };
	}

	const legacyRecipePayload =
		assistantLegacyRecipeContextPayloadSchema.safeParse(legacyRecipeContext);
	return legacyRecipePayload.success ? { recipe: legacyRecipePayload.data.recipe } : undefined;
}

export type AssistantActionVerbId = z.infer<typeof assistantActionVerbIdSchema>;
export type AssistantActionItemKind = z.infer<typeof assistantActionItemKindSchema>;
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

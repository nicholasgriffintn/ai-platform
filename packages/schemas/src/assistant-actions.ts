import z from "zod/v4";

import { recipeChatRequestOptionsSchema, recipeConnectorProviderSchema } from "./apps";
import { chatRequestOptionsSchema } from "./chat";

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

const assistantActionResultBaseSchema = z.object({
	input: z.string(),
	notification: assistantActionNotificationSchema.optional(),
	selectedTools: z.array(z.string()).optional(),
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
export type AssistantActionSubmitResult = z.input<typeof assistantActionSubmitResultSchema>;
export type AssistantActionConversationResult = z.input<
	typeof assistantActionConversationResultSchema
>;
export type AssistantActionNavigationResult = z.input<typeof assistantActionNavigationResultSchema>;
export type AssistantActionExternalResult = z.input<typeof assistantActionExternalResultSchema>;
export type AssistantActionResult = z.input<typeof assistantActionResultSchema>;

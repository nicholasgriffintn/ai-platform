import {
	errorResponseSchema,
	composioTriggerTypesResponseSchema,
	recipeConnectorProviderSchema,
	recipeComposioTriggerCreateRequestSchema,
	recipeComposioTriggerSchema,
	recipeComposioTriggersResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import {
	createRecipeComposioTrigger,
	deleteRecipeComposioTrigger,
	listRecipeComposioTriggers,
	listRecipeComposioTriggerTypes,
	setRecipeComposioTriggerStatus,
} from "~/services/apps/recipes/composio-triggers";

const app = new Hono();
const installationParamsSchema = z.object({ installationId: z.string().min(1) });
const triggerParamsSchema = z.object({ triggerId: z.string().min(1) });
const triggerStatusSchema = z.object({ status: z.enum(["active", "paused"]) });
const triggerTypeQuerySchema = z.object({ providerId: recipeConnectorProviderSchema });

addRoute(app, "get", "/installations/:installationId/composio-trigger-types", {
	auth: true,
	tags: ["apps"],
	paramSchema: installationParamsSchema,
	querySchema: triggerTypeQuerySchema,
	responses: {
		200: {
			description: "Available Composio trigger types",
			schema: composioTriggerTypesResponseSchema,
		},
		404: { description: "Recipe installation not found", schema: errorResponseSchema },
	},
	handler: ({ params, query, serviceContext, user }) =>
		listRecipeComposioTriggerTypes({
			context: serviceContext,
			userId: user.id,
			installationId: params.installationId,
			providerId: query.providerId,
		}),
});

addRoute(app, "get", "/installations/:installationId/composio-triggers", {
	auth: true,
	tags: ["apps"],
	paramSchema: installationParamsSchema,
	responses: {
		200: { description: "Composio event triggers", schema: recipeComposioTriggersResponseSchema },
		404: { description: "Recipe installation not found", schema: errorResponseSchema },
	},
	handler: ({ params, serviceContext, user }) =>
		listRecipeComposioTriggers({
			context: serviceContext,
			userId: user.id,
			installationId: params.installationId,
		}),
});

addRoute(app, "post", "/installations/:installationId/composio-triggers", {
	auth: true,
	tags: ["apps"],
	paramSchema: installationParamsSchema,
	bodySchema: recipeComposioTriggerCreateRequestSchema,
	responses: {
		200: { description: "Created Composio event trigger", schema: recipeComposioTriggerSchema },
		404: { description: "Recipe installation or account not found", schema: errorResponseSchema },
	},
	handler: ({ params, body, serviceContext, user }) =>
		createRecipeComposioTrigger({
			context: serviceContext,
			userId: user.id,
			installationId: params.installationId,
			input: body,
		}),
});

addRoute(app, "put", "/composio-triggers/:triggerId", {
	auth: true,
	tags: ["apps"],
	paramSchema: triggerParamsSchema,
	bodySchema: triggerStatusSchema,
	responses: {
		200: { description: "Updated Composio event trigger", schema: recipeComposioTriggerSchema },
		404: { description: "Composio event trigger not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) => {
		const trigger = await setRecipeComposioTriggerStatus({
			context: serviceContext,
			userId: user.id,
			triggerId: params.triggerId,
			status: body.status,
		});
		return trigger ?? ResponseFactory.error(raw, "Composio event trigger not found", 404);
	},
});

addRoute(app, "delete", "/composio-triggers/:triggerId", {
	auth: true,
	tags: ["apps"],
	paramSchema: triggerParamsSchema,
	responses: {
		204: { description: "Composio event trigger deleted" },
		404: { description: "Composio event trigger not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, serviceContext, user }) => {
		const deleted = await deleteRecipeComposioTrigger({
			context: serviceContext,
			userId: user.id,
			triggerId: params.triggerId,
		});
		return deleted
			? ResponseFactory.noContent(raw)
			: ResponseFactory.error(raw, "Composio event trigger not found", 404);
	},
});

export default app;

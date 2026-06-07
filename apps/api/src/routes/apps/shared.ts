import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import { z } from "zod/v4";

import {
	shareItemSchema,
	sharedItemResponseSchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getSharedItem, shareItem, unshareItem } from "~/services/apps/shared";
import type { IEnv } from "~/types";
import { AssistantError } from "~/utils/errors";

const app = new Hono<{
	Bindings: IEnv;
}>();

const routeLogger = createRouteLogger("apps/shared");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing shared apps route: ${c.req.path}`);
	return next();
});

const shareIdParamsSchema = z.object({
	share_id: z.string().min(1),
});

const appIdParamsSchema = z.object({
	app_id: z.string().min(1),
});

addRoute(app, "post", "/", {
	tags: ["apps"],
	description: "Generate a share ID for an app item",
	bodySchema: shareItemSchema,
	auth: true,
	responses: {
		200: {
			description: "Share ID generated successfully",
			schema: apiResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
		404: { description: "Item not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ body, raw, serviceContext, user }) => {
		try {
			const { shareId } = await shareItem({
				userId: user.id,
				id: body.app_id,
				context: serviceContext,
			});

			return { share_id: shareId };
		} catch (error) {
			routeLogger.error("Error sharing item:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});

			if (error instanceof AssistantError) {
				return ResponseFactory.error(raw, error.message);
			}

			return ResponseFactory.error(raw, "Failed to share item", 500);
		}
	},
});

addRoute(app, "get", "/:share_id", {
	tags: ["apps"],
	description: "Get a shared app item by its share ID",
	paramSchema: shareIdParamsSchema,
	responses: {
		200: {
			description: "Shared item retrieved successfully",
			schema: sharedItemResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		404: { description: "Item not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ params, raw, serviceContext }) => {
		routeLogger.info(`Fetching shared item with ID: ${params.share_id}`);

		try {
			const sharedItem = await getSharedItem({
				context: serviceContext,
				shareId: params.share_id,
			});

			return {
				item: {
					id: sharedItem.id,
					app_id: sharedItem.appId,
					item_id: sharedItem.itemId,
					item_type: sharedItem.itemType,
					data: sharedItem.data,
					share_id: sharedItem.shareId,
					created_at: sharedItem.createdAt,
					updated_at: sharedItem.updatedAt,
				},
			};
		} catch (error) {
			routeLogger.error("Error retrieving shared item:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});

			if (error instanceof AssistantError) {
				return ResponseFactory.error(raw, error.message);
			}

			return ResponseFactory.error(raw, "Failed to retrieve shared item", 500);
		}
	},
});

addRoute(app, "delete", "/:app_id", {
	tags: ["apps"],
	description: "Remove a share ID from an app item",
	paramSchema: appIdParamsSchema,
	auth: true,
	responses: {
		200: {
			description: "Share ID removed successfully",
			schema: apiResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
		404: { description: "Item not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ params, raw, serviceContext, user }) => {
		try {
			await unshareItem({
				userId: user.id,
				id: params.app_id,
				context: serviceContext,
			});

			return { message: "Share removed" };
		} catch (error) {
			routeLogger.error("Error unsharing item:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});

			if (error instanceof AssistantError) {
				return ResponseFactory.error(raw, error.message);
			}

			return ResponseFactory.error(raw, "Failed to unshare item", 500);
		}
	},
});

export default app;

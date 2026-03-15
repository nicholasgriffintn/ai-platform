import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	shareItemSchema,
	sharedItemResponseSchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getSharedItem, shareItem } from "~/services/apps/shared";
import type { IEnv, IUser } from "~/types";
import { AssistantError } from "~/utils/errors";

const app = new Hono<{
	Bindings: IEnv;
}>();

const routeLogger = createRouteLogger("apps/shared");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing shared apps route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/", {
	tags: ["apps"],
	description: "Generate a share ID for an app item",
	bodySchema: shareItemSchema,
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
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as IUser;

			if (!user?.id) {
				return ResponseFactory.error(c, "Unauthorized", 401);
			}

			try {
				const body = await c.req.json();
				const { app_id } = body;

				const serviceContext = getServiceContext(c);
				const { shareId } = await shareItem({
					userId: user.id,
					id: app_id,
					context: serviceContext,
				});

				return ResponseFactory.success(c, { share_id: shareId });
			} catch (error) {
				routeLogger.error("Error sharing item:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});

				if (error instanceof AssistantError) {
					return ResponseFactory.error(c, error.message);
				}

				return ResponseFactory.error(c, "Failed to share item", 500);
			}
		})(raw),
});

addRoute(app, "get", "/:share_id", {
	tags: ["apps"],
	description: "Get a shared app item by its share ID",
	responses: {
		200: {
			description: "Shared item retrieved successfully",
			schema: sharedItemResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		404: { description: "Item not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const share_id = c.req.param("share_id");
			routeLogger.info(`Fetching shared item with ID: ${share_id}`);

			if (!share_id) {
				return ResponseFactory.error(c, "Share ID is required", 400);
			}

			try {
				const serviceContext = getServiceContext(c);
				const sharedItem = await getSharedItem({
					context: serviceContext,
					shareId: share_id,
				});

				return ResponseFactory.success(c, {
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
				});
			} catch (error) {
				routeLogger.error("Error retrieving shared item:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});

				if (error instanceof AssistantError) {
					return ResponseFactory.error(c, error.message);
				}

				return ResponseFactory.error(c, "Failed to retrieve shared item", 500);
			}
		})(raw),
});

export default app;

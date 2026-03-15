import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	errorResponseSchema,
	successResponseSchema,
	createApiKeySchema,
	deleteApiKeyParamsSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	createUserApiKey,
	deleteUserApiKey,
	getUserApiKeys,
} from "~/services/user/apiKeys";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "routes/user/apiKeys" });

const app = new Hono();

app.use("*", requireAuth);

addRoute(app, "get", "/", {
	tags: ["user"],
	summary: "Get API Keys",
	description: "Get all API keys for the user",
	responses: {
		200: {
			description: "API keys fetched successfully",
			schema: successResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			const serviceContext = getServiceContext(c);

			try {
				const keys = await getUserApiKeys(serviceContext, user.id);
				return ResponseFactory.success(c, keys);
			} catch (error) {
				logger.error("Error fetching API keys:", { error });
				if (error instanceof AssistantError) {
					throw error;
				}
				throw new AssistantError(
					"Failed to fetch API keys",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/", {
	tags: ["user"],
	summary: "Create API Key",
	description: "Create a new API key for the user",
	bodySchema: createApiKeySchema,
	responses: {
		201: {
			description: "API key created successfully",
			schema: successResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { name } = c.req.valid("json" as never) as { name: string };
			const serviceContext = getServiceContext(c);

			try {
				const { plaintextKey, metadata } = await createUserApiKey(
					serviceContext,
					name,
				);

				return ResponseFactory.success(
					c,
					{ apiKey: plaintextKey, ...metadata },
					201,
				);
			} catch (error) {
				logger.error("Error creating API key:", { error });
				if (error instanceof AssistantError) {
					throw error;
				}
				throw new AssistantError(
					"Failed to create API key",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "delete", "/:keyId", {
	tags: ["user"],
	summary: "Delete API Key",
	description: "Delete an API key for the user",
	paramSchema: deleteApiKeyParamsSchema,
	responses: {
		200: {
			description: "API key deleted successfully",
			schema: successResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			const { keyId } = c.req.valid("param" as never) as { keyId: string };
			const serviceContext = getServiceContext(c);

			try {
				await deleteUserApiKey(serviceContext, keyId, user.id);
				return ResponseFactory.success(
					c,
					{ message: "API key deleted successfully" },
					200,
				);
			} catch (error) {
				logger.error("Error deleting API key:", { error });
				if (error instanceof AssistantError) {
					throw error;
				}
				throw new AssistantError(
					"Failed to delete API key",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

export default app;

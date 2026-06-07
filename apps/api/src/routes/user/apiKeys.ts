import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import {
	errorResponseSchema,
	successResponseSchema,
	createApiKeySchema,
	deleteApiKeyParamsSchema,
} from "@assistant/schemas";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { createUserApiKey, deleteUserApiKey, getUserApiKeys } from "~/services/user/apiKeys";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "routes/user/apiKeys" });

const app = new Hono();

addRoute(app, "get", "/", {
	tags: ["user"],
	summary: "Get API Keys",
	description: "Get all API keys for the user",
	auth: true,
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
	handler: async ({ serviceContext, user }) => {
		try {
			return await getUserApiKeys(serviceContext, user.id);
		} catch (error) {
			logger.error("Error fetching API keys:", { error });
			if (error instanceof AssistantError) {
				throw error;
			}
			throw new AssistantError("Failed to fetch API keys", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/", {
	tags: ["user"],
	summary: "Create API Key",
	description: "Create a new API key for the user",
	auth: true,
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
	handler: async ({ body, raw, serviceContext }) => {
		try {
			const { plaintextKey, metadata } = await createUserApiKey(serviceContext, body.name);

			return ResponseFactory.success(raw, { apiKey: plaintextKey, ...metadata }, 201);
		} catch (error) {
			logger.error("Error creating API key:", { error });
			if (error instanceof AssistantError) {
				throw error;
			}
			throw new AssistantError("Failed to create API key", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "delete", "/:keyId", {
	tags: ["user"],
	summary: "Delete API Key",
	description: "Delete an API key for the user",
	auth: true,
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
	handler: async ({ params, serviceContext, user }) => {
		try {
			await deleteUserApiKey(serviceContext, params.keyId, user.id);
			return { message: "API key deleted successfully" };
		} catch (error) {
			logger.error("Error deleting API key:", { error });
			if (error instanceof AssistantError) {
				throw error;
			}
			throw new AssistantError("Failed to delete API key", ErrorType.UNKNOWN_ERROR);
		}
	},
});

export default app;

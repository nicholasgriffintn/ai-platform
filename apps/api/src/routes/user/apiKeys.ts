import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
  errorResponseSchema,
  successResponseSchema,
  createApiKeySchema,
  deleteApiKeyParamsSchema,
} from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
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

app.get(
  "/",
  describeRoute({
    tags: ["user"],
    summary: "Get API Keys",
    description: "Get all API keys for the user",
    responses: {
      200: {
        description: "API keys fetched successfully",
        content: {
          "application/json": {
            schema: resolver(successResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user");
    const userId = user.id;

    try {
      const keys = await getUserApiKeys(c.env, userId);
      return c.json(keys);
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
  },
);

app.post(
  "/",
  describeRoute({
    tags: ["user"],
    summary: "Create API Key",
    description: "Create a new API key for the user",
    responses: {
      201: {
        description: "API key created successfully",
        content: {
          "application/json": {
            schema: resolver(successResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", createApiKeySchema),
  async (c: Context) => {
    const user = c.get("user");
    const userId = user.id;
    const db = c.env.DB;
    const { name } = c.req.valid("json" as never) as { name: string };

    try {
      const { plaintextKey, metadata } = await createUserApiKey(
        c.env,
        userId,
        name,
      );

      return c.json({ apiKey: plaintextKey, ...metadata }, 201);
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
  },
);

app.delete(
  "/:keyId",
  describeRoute({
    tags: ["user"],
    summary: "Delete API Key",
    description: "Delete an API key for the user",
    responses: {
      200: {
        description: "API key deleted successfully",
        content: {
          "application/json": {
            schema: resolver(successResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", deleteApiKeyParamsSchema),
  async (c: Context) => {
    const user = c.get("user");
    const userId = user.id;
    const db = c.env.DB;
    const { keyId } = c.req.valid("param" as never) as { keyId: string };

    try {
      await deleteUserApiKey(c.env, userId, keyId);
      return c.json({ message: "API key deleted successfully" }, 200);
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
  },
);

export default app;

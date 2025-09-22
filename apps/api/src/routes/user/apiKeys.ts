import { type Context, Hono } from "hono";
import { validator } from "hono/validator";

import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi";
import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { errorResponseSchema, successResponseSchema } from "../schemas/shared";
import {
  createApiKeySchema,
  deleteApiKeyParamsSchema,
} from "../schemas/user/apiKeys";

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
    const db = c.env.DB;

    try {
      const database = Database.getInstance(db);
      const keys = await database.getUserApiKeys(userId);
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
  validator("json", (value, _c) => {
    const parsed = createApiKeySchema.safeParse(value);
    if (!parsed.success) {
      throw new AssistantError(
        `Invalid input: ${parsed.error.message}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
    return parsed.data;
  }),
  async (c: Context) => {
    const user = c.get("user");
    const userId = user.id;
    const db = c.env.DB;
    const { name } = c.req.valid("json" as never) as { name: string };

    try {
      const database = Database.getInstance(db);
      const { plaintextKey, metadata } = await database.createApiKey(
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
  validator("param", (value, _c) => {
    const parsed = deleteApiKeyParamsSchema.safeParse(value);
    if (!parsed.success) {
      throw new AssistantError(
        "Invalid API Key ID parameter",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
    return parsed.data;
  }),
  async (c: Context) => {
    const user = c.get("user");
    const userId = user.id;
    const db = c.env.DB;
    const { keyId } = c.req.valid("param" as never) as { keyId: string };

    try {
      const database = Database.getInstance(db);
      await database.deleteApiKey(userId, keyId);
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

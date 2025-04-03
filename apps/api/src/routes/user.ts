import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type { z } from "zod";

import { Database } from "../lib/database";
import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "../utils/errors";
import {
  storeProviderApiKeySchema,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
} from "./schemas/user";

const app = new Hono();
const routeLogger = createRouteLogger("USER");

// Require authentication for all routes
app.use("/*", requireAuth);

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing user route: ${c.req.path}`);
  return next();
});

app.put(
  "/settings",
  describeRoute({
    tags: ["user"],
    summary: "Update user settings",
    responses: {
      200: {
        description: "User settings updated successfully",
        content: {
          "application/json": {
            schema: resolver(updateUserSettingsResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
      },
    },
  }),
  zValidator("json", updateUserSettingsSchema),
  async (c: Context) => {
    const settings = c.req.valid("json" as never) as z.infer<
      typeof updateUserSettingsSchema
    >;
    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    await database.updateUserSettings(user.id, settings);

    return c.json({
      success: true,
      message: "User settings updated successfully",
    });
  },
);

app.get(
  "/models",
  describeRoute({
    tags: ["user"],
    summary: "Get the models that the user has enabled",
    responses: {
      200: {
        description: "Models retrieved successfully",
        content: {
          "application/json": {
            schema: resolver(updateUserSettingsResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    const models = await database.getUserEnabledModels(user.id);

    return c.json({
      success: true,
      models,
    });
  },
);

app.post(
  "/store-provider-api-key",
  describeRoute({
    tags: ["user"],
    summary: "Store provider API key",
    responses: {
      200: {
        description: "Provider API key stored successfully",
        content: {
          "application/json": {
            schema: resolver(updateUserSettingsResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
      },
    },
  }),
  zValidator("json", storeProviderApiKeySchema),
  async (c: Context) => {
    const user = c.get("user");
    const { providerId, apiKey } = c.req.valid("json" as never) as z.infer<
      typeof storeProviderApiKeySchema
    >;

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    await database.storeProviderApiKey(user.id, providerId, apiKey);

    return c.json({
      success: true,
      message: "Provider API key stored successfully",
    });
  },
);

app.get(
  "/providers",
  describeRoute({
    tags: ["user"],
    summary: "Get the providers that the user has enabled",
  }),
  async (c: Context) => {
    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    const userProviderSettings = await database.getUserProviderSettings(
      user.id,
    );

    return c.json({
      success: true,
      providers: userProviderSettings,
    });
  },
);

app.post(
  "/sync-providers",
  describeRoute({
    tags: ["user"],
    summary: "Sync providers",
  }),
  async (c: Context) => {
    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    await database.createUserProviderSettings(user.id);

    return c.json({
      success: true,
      message: "Providers synced successfully",
    });
  },
);

export default app;

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { Database } from "../lib/database";
import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "../utils/errors";
import { errorResponseSchema, successResponseSchema } from "./schemas/shared";
import {
  storeProviderApiKeySchema,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
} from "./schemas/user";
import apiKeys from "./user/apiKeys";

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

// Common response schemas
const modelsResponseSchema = z.object({
  success: z.boolean(),
  models: z.array(z.string()),
});

const providersResponseSchema = z.object({
  success: z.boolean(),
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      enabled: z.boolean(),
      hasApiKey: z.boolean().optional(),
    }),
  ),
});

app.put(
  "/settings",
  describeRoute({
    tags: ["user"],
    summary: "Update user settings",
    description: "Updates various user preferences and settings",
    requestBody: {
      description: "User settings to update",
      required: true,
      content: {
        "application/json": {
          schema: resolver(updateUserSettingsSchema),
        },
      },
    },
    responses: {
      200: {
        description: "User settings updated successfully",
        content: {
          "application/json": {
            schema: resolver(updateUserSettingsResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
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
    description:
      "Returns a list of model IDs that the user has enabled for use",
    responses: {
      200: {
        description: "List of enabled models",
        content: {
          "application/json": {
            schema: resolver(modelsResponseSchema),
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
    description: "Stores a provider API key for the authenticated user",
    requestBody: {
      description: "Provider API key details",
      required: true,
      content: {
        "application/json": {
          schema: resolver(storeProviderApiKeySchema),
        },
      },
    },
    responses: {
      200: {
        description: "Provider API key stored successfully",
        content: {
          "application/json": {
            schema: resolver(successResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
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
  zValidator("json", storeProviderApiKeySchema),
  async (c: Context) => {
    const user = c.get("user");
    const { providerId, apiKey, secretKey } = c.req.valid(
      "json" as never,
    ) as z.infer<typeof storeProviderApiKeySchema>;

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    await database.storeProviderApiKey(user.id, providerId, apiKey, secretKey);

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
    description: "Returns a list of providers and their settings for the user",
    responses: {
      200: {
        description: "List of provider settings",
        content: {
          "application/json": {
            schema: resolver(providersResponseSchema),
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
    description: "Synchronizes available providers for the user",
    responses: {
      200: {
        description: "Providers synced successfully",
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

app.route("/api-keys", apiKeys);

export default app;

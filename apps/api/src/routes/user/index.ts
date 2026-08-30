import {
  errorResponseSchema,
  successResponseSchema,
  deleteProviderApiKeyParamsSchema,
  storeProviderApiKeySchema,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
  userModelsResponseSchema,
  providersResponseSchema,
  providerSyncStatusSchema,
} from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  updateUserSettings,
  deleteProviderApiKey,
  getUserEnabledModels,
  storeProviderApiKey,
  getUserProviderSettings,
  getUserProviderSyncStatus,
  syncUserProviders,
} from "~/services/user/userOperations";
import { AssistantError, ErrorType } from "~/utils/errors";

import apiKeys from "./apiKeys";
import exportHistoryRoute from "./export-history";
import pets from "./pets";

const app = new Hono();
const routeLogger = createRouteLogger("user");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
  routeLogger.info(`Processing user route: ${c.req.path}`);

  return next();
});

addRoute(app, "put", "/settings", {
  tags: ["user"],
  summary: "Update user settings",
  description: "Updates various user preferences and settings",
  bodySchema: updateUserSettingsSchema,
  responses: {
    200: {
      description: "User settings updated successfully",
      schema: updateUserSettingsResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const settings = c.req.valid("json" as never) as typeof updateUserSettingsSchema;
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const result = await updateUserSettings(serviceContext, settings, user.id);

      return ResponseFactory.success(c, result);
    })(raw),
});

addRoute(app, "get", "/models", {
  tags: ["user"],
  summary: "Get the models that the user has enabled",
  description: "Returns a list of model IDs that the user has enabled for use",
  responses: {
    200: {
      description: "List of enabled models",
      schema: userModelsResponseSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const models = await getUserEnabledModels(serviceContext, user.id);

      return ResponseFactory.success(c, models);
    })(raw),
});

addRoute(app, "post", "/store-provider-api-key", {
  tags: ["user"],
  summary: "Store provider API key",
  description: "Stores a provider API key for the authenticated user",
  bodySchema: storeProviderApiKeySchema,
  responses: {
    200: {
      description: "Provider API key stored successfully",
      schema: successResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");
      const { providerId, apiKey, secretKey, configuration } = c.req.valid("json" as never) as {
        providerId: string;
        apiKey: string;
        secretKey?: string;
        configuration?: Record<string, unknown>;
      };

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const result = await storeProviderApiKey(
        serviceContext,
        providerId,
        apiKey,
        secretKey,
        configuration,
        user.id,
      );

      return ResponseFactory.success(c, result);
    })(raw),
});

addRoute(app, "get", "/providers", {
  tags: ["user"],
  summary: "Get the providers that the user has enabled",
  description: "Returns a list of providers and their settings for the user",
  responses: {
    200: {
      description: "List of provider settings",
      schema: providersResponseSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const providers = await getUserProviderSettings(serviceContext, user.id);

      return ResponseFactory.success(c, providers);
    })(raw),
});

addRoute(app, "get", "/providers/sync-status", {
  tags: ["user"],
  summary: "Check whether providers need syncing",
  description: "Reports whether the user's provider catalogue is missing available providers",
  responses: {
    200: {
      description: "Provider sync status",
      schema: providerSyncStatusSchema,
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const status = await getUserProviderSyncStatus(getServiceContext(c), user.id);

      return ResponseFactory.success(c, status);
    })(raw),
});

addRoute(app, "delete", "/providers/:providerId", {
  tags: ["user"],
  summary: "Delete provider API key",
  description: "Deletes the stored API key for a provider and disables it for the user",
  paramSchema: deleteProviderApiKeyParamsSchema,
  responses: {
    200: {
      description: "Provider API key deleted successfully",
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
      const { providerId } = c.req.valid("param" as never) as { providerId: string };

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const result = await deleteProviderApiKey(serviceContext, providerId, user.id);

      return ResponseFactory.success(c, result);
    })(raw),
});

addRoute(app, "post", "/sync-providers", {
  tags: ["user"],
  summary: "Sync providers",
  description: "Synchronizes available providers for the user",
  responses: {
    200: {
      description: "Providers synced successfully",
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

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const serviceContext = getServiceContext(c);
      const result = await syncUserProviders(serviceContext, user.id);

      return ResponseFactory.success(c, result);
    })(raw),
});

app.route("/api-keys", apiKeys);
app.route("/export-chat-history", exportHistoryRoute);
app.route("/pets", pets);

export default app;

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getSharedItem, shareItem } from "~/services/apps/shared";
import type { IEnv, IUser } from "~/types";
import { AssistantError } from "~/utils/errors";
import { shareItemSchema, sharedItemResponseSchema } from "../schemas/apps";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";

const app = new Hono<{
  Bindings: IEnv;
}>();

const routeLogger = createRouteLogger("APPS_SHARED");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing shared apps route: ${c.req.path}`);
  return next();
});

app.post(
  "/",
  describeRoute({
    tags: ["apps", "shared"],
    description: "Generate a share ID for an app item",
    requestBody: {
      description: "Item to share",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              app_id: {
                type: "string",
                description: "The ID of the app",
              },
              item_id: {
                type: "string",
                description: "The ID of the item to share",
              },
            },
            required: ["app_id", "item_id"],
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: "Share ID generated successfully",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Item not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", shareItemSchema),
  async (c: Context) => {
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          status: "error",
          message: "Unauthorized",
        },
        401,
      );
    }

    try {
      const body = await c.req.json();
      const { app_id } = body;

      const { shareId } = await shareItem({
        userId: user.id,
        id: app_id,
        env: c.env,
      });

      return c.json({
        status: "success",
        share_id: shareId,
      });
    } catch (error) {
      routeLogger.error("Error sharing item:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof AssistantError) {
        return c.json({
          status: "error",
          message: error.message,
        });
      }

      return c.json(
        {
          status: "error",
          message: "Failed to share item",
        },
        500,
      );
    }
  },
);

app.get(
  "/:share_id",
  describeRoute({
    tags: ["apps", "shared"],
    description: "Get a shared app item by its share ID",
    parameters: [
      {
        name: "share_id",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
        description: "The share ID of the item",
      },
    ],
    responses: {
      200: {
        description: "Shared item retrieved successfully",
        content: {
          "application/json": {
            schema: resolver(sharedItemResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Item not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const share_id = c.req.param("share_id");
    routeLogger.info(`Fetching shared item with ID: ${share_id}`);

    if (!share_id) {
      return c.json(
        {
          status: "error",
          message: "Share ID is required",
        },
        400,
      );
    }

    try {
      const sharedItem = await getSharedItem({
        env: c.env,
        shareId: share_id,
      });

      return c.json({
        status: "success",
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
        error_message: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof AssistantError) {
        return c.json({
          status: "error",
          message: error.message,
        });
      }

      return c.json(
        {
          status: "error",
          message: "Failed to retrieve shared item",
        },
        500,
      );
    }
  },
);

export default app;

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { Database } from "../lib/database";
import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "../utils/errors";
import { updateUserSettingsSchema } from "./schemas/user";

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
            schema: resolver(
              z.object({
                success: z.boolean(),
                message: z.string(),
              }),
            ),
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

export default app;

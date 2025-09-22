import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { checkPlanRequirement } from "~/services/user/userOperations";
import { generateImageFromDrawing } from "~/services/apps/drawing/create";
import { getDrawingDetails } from "~/services/apps/drawing/get-details";
import { guessDrawingFromImage } from "~/services/apps/drawing/guess";
import { listDrawings } from "~/services/apps/drawing/list";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { drawingSchema, guessDrawingSchema } from "../schemas/apps";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("apps/drawing");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["apps", "drawing"],
    description: "List user's drawings",
    responses: {
      200: {
        description: "List of user's drawings",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
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
    },
  }),
  async (c: Context) => {
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return c.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    try {
      const drawings = await listDrawings({
        env: c.env as IEnv,
        userId: user.id,
      });

      return c.json({
        status: "success",
        drawings,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error listing drawings:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to list drawings",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.get(
  "/:id",
  describeRoute({
    tags: ["apps", "drawing"],
    description: "Get drawing details",
    responses: {
      200: {
        description: "Drawing details",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      404: {
        description: "Drawing not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          status: "error",
          message: "User not authenticated",
        },
        401,
      );
    }

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return c.json(
        {
          status: "error",
          message: planCheck.message,
        },
        401,
      );
    }

    try {
      const drawing = await getDrawingDetails({
        env: c.env as IEnv,
        userId: user.id,
        drawingId: id,
      });

      return c.json({
        status: "success",
        drawing,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error fetching drawing:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to fetch drawing",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.post(
  "/",
  describeRoute({
    tags: ["apps", "drawing"],
    description: "Generate an image from a drawing",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("form", drawingSchema),
  async (c: Context) => {
    const body = c.req.valid("form" as never) as {
      drawing: File;
      drawingId?: string;
    };
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          status: "error",
          message: "User not authenticated",
        },
        401,
      );
    }

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return c.json(
        {
          status: "error",
          message: planCheck.message,
        },
        401,
      );
    }

    try {
      const response = await generateImageFromDrawing({
        env: c.env as IEnv,
        request: body,
        user,
        existingDrawingId: body.drawingId,
      });

      if (response.status === "error") {
        throw new AssistantError(
          "Something went wrong, we are working on it",
          ErrorType.UNKNOWN_ERROR,
        );
      }

      return c.json(response);
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error generating image from drawing:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to generate image",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.post(
  "/guess",
  describeRoute({
    tags: ["apps", "drawing"],
    description: "Guess a drawing from an image",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("form", guessDrawingSchema),
  async (c: Context) => {
    const body = c.req.valid("form" as never);
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          status: "error",
          message: "User not authenticated",
        },
        401,
      );
    }

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return c.json(
        {
          status: "error",
          message: planCheck.message,
        },
        401,
      );
    }

    try {
      const response = await guessDrawingFromImage({
        env: c.env as IEnv,
        request: body,
        user,
      });

      if (response.status === "error") {
        throw new AssistantError(
          "Something went wrong, we are working on it",
          ErrorType.UNKNOWN_ERROR,
        );
      }

      return c.json(response);
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error guessing drawing from image:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to guess drawing",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

export default app;

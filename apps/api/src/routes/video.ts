import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleVideoToNotes } from "~/services/video/notes";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { videoNotesResponseSchema, videoStatusResponseSchema, videoToNotesSchema } from "./schemas/video";

const app = new Hono();

const routeLogger = createRouteLogger("VIDEO");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
  routeLogger.info(`Processing video route: ${c.req.path}`);
  return next();
});

app.post(
  "/notes",
  describeRoute({
    tags: ["video"],
    summary: "Generate notes from a video URL",
    description: "Extracts audio from a video URL, transcribes it, and generates structured notes.",
    responses: {
      200: {
        description: "Video note creation result",
        content: {
          "application/json": {
            schema: resolver(videoNotesResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
      },
    },
  }),
  zValidator("json", videoToNotesSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as {
      url: string;
      timestamps?: boolean;
      provider?: "workers" | "mistral";
      generateSummary?: boolean;
    };
    const user = context.get("user") as IUser;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    try {
      const response = await handleVideoToNotes({
        env: context.env as IEnv,
        user,
        url: body.url,
        timestamps: body.timestamps,
        provider: body.provider,
        generateSummary: body.generateSummary,
      });

      return context.json({ response });
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      routeLogger.error("Error generating video notes:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to generate video notes", ErrorType.UNKNOWN_ERROR);
    }
  },
);

app.get(
  "/notes/:id/status",
  describeRoute({
    tags: ["video"],
    summary: "Check processing status for a video note",
    responses: {
      200: {
        description: "Processing status",
        content: {
          "application/json": {
            schema: resolver(videoStatusResponseSchema),
          },
        },
      },
      404: {
        description: "Not found",
      },
    },
  }),
  async (context: Context) => {
    const id = context.req.param("id");
    const user = context.get("user") as IUser;

    if (!user?.id) {
      return context.json(
        {
          status: "error",
          message: "User not authenticated",
        },
        401,
      );
    }

    try {
      const repo = (await import("~/repositories")).RepositoryManager.getInstance(context.env as IEnv).appData;
      const entry = await repo.getAppDataById(id);
      if (!entry || entry.user_id !== user.id) {
        return context.json({ status: "error", message: "Not found" }, 404);
      }

      let data: any = {};
      try {
        data = JSON.parse(entry.data);
      } catch {
        data = {};
      }

      return context.json({
        status: data.status || data.metadata?.processingStatus || "complete",
        progress: data.progress || 100,
        data: { id: entry.id },
      });
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      routeLogger.error("Error checking status:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to check status", ErrorType.UNKNOWN_ERROR);
    }
  },
);

export default app;
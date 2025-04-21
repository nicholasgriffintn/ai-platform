import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handlePodcastGenerateImage } from "~/services/apps/podcast/generate-image";
import {
  type IPodcastSummariseBody,
  handlePodcastSummarise,
} from "~/services/apps/podcast/summarise";
import {
  type IPodcastTranscribeBody,
  handlePodcastTranscribe,
} from "~/services/apps/podcast/transcribe";
import {
  type UploadRequest,
  handlePodcastUpload,
} from "~/services/apps/podcast/upload";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  podcastGenerateImageSchema,
  podcastSummarizeSchema,
  podcastTranscribeSchema,
  podcastUploadSchema,
} from "../schemas/apps";
import { apiResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_PODCASTS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.post(
  "/upload",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Upload a podcast",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", podcastUploadSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as UploadRequest["request"];
    const user = context.get("user");

    const response = await handlePodcastUpload({
      env: context.env as IEnv,
      request: body,
      user,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

app.post(
  "/transcribe",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Transcribe a podcast",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", podcastTranscribeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
    const user = context.get("user");

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await handlePodcastTranscribe({
      env: context.env as IEnv,
      request: body,
      user,
      app_url,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/summarise",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Summarise a podcast",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", podcastSummarizeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastSummariseBody;
    const user = context.get("user");

    const response = await handlePodcastSummarise({
      env: context.env as IEnv,
      request: body,
      user,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/generate-image",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Generate an image for a podcast",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", podcastGenerateImageSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
    const user = context.get("user");

    const response = await handlePodcastGenerateImage({
      env: context.env as IEnv,
      request: body,
      user,
    });

    return context.json({
      response,
    });
  },
);

export default app;

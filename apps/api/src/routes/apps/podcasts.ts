import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handlePodcastGenerateImage } from "~/services/apps/podcast/generate-image";
import { handlePodcastDetail } from "~/services/apps/podcast/get-details";
import { handlePodcastList } from "~/services/apps/podcast/list";
import {
  type IPodcastSummariseBody,
  handlePodcastSummarise,
} from "~/services/apps/podcast/summarise";
import {
  type IPodcastTranscribeBody,
  handlePodcastTranscribe,
} from "~/services/apps/podcast/transcribe";
import { handlePodcastUpload } from "~/services/apps/podcast/upload";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  podcastGenerateImageSchema,
  podcastSummarizeSchema,
  podcastTranscribeSchema,
} from "../schemas/apps";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_PODCASTS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

/**
 * List podcasts endpoint
 */
app.get(
  "/",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "List user's podcasts",
    responses: {
      200: {
        description: "List of user's podcasts",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                podcasts: z.array(
                  z.object({
                    id: z.string(),
                    title: z.string(),
                    createdAt: z.string(),
                    imageUrl: z.string().optional(),
                    duration: z.number().optional(),
                    status: z.enum([
                      "processing",
                      "transcribing",
                      "summarizing",
                      "complete",
                    ]),
                  }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user");

    try {
      const podcasts = await handlePodcastList({
        env: context.env as IEnv,
        user,
      });

      return context.json({
        podcasts,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching podcasts:", error);
      throw new AssistantError(
        "Failed to fetch podcasts",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

/**
 * Get a specific podcast
 */
app.get(
  "/:id",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Get podcast details",
    responses: {
      200: {
        description: "Podcast details",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                podcast: z.object({
                  id: z.string(),
                  title: z.string(),
                  description: z.string().optional(),
                  createdAt: z.string(),
                  imageUrl: z.string().optional(),
                  audioUrl: z.string(),
                  duration: z.number().optional(),
                  transcript: z.string().optional(),
                  summary: z.string().optional(),
                  status: z.enum([
                    "processing",
                    "transcribing",
                    "summarizing",
                    "complete",
                  ]),
                }),
              }),
            ),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const id = context.req.param("id");
    const user = context.get("user");

    try {
      const podcast = await handlePodcastDetail({
        env: context.env as IEnv,
        podcastId: id,
        user,
      });

      return context.json({
        podcast,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching podcast:", error);
      throw new AssistantError(
        "Failed to fetch podcast",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

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
  async (context: Context) => {
    try {
      const formData = await context.req.formData();
      const title = formData.get("title") as string;
      const description = formData.get("description") as string | null;
      const audio = formData.get("audio") as File | null;
      const audioUrl = formData.get("audioUrl") as string | null;

      if (!audio && !audioUrl) {
        throw new AssistantError(
          "Missing audio file or URL",
          ErrorType.PARAMS_ERROR,
        );
      }

      const user = context.get("user");

      const response = await handlePodcastUpload({
        env: context.env as IEnv,
        request: {
          audio,
          audioUrl,
          title,
          description: description || undefined,
        },
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
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error uploading podcast:", error);
      throw new AssistantError(
        "Failed to upload podcast",
        ErrorType.UNKNOWN_ERROR,
      );
    }
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
    const body = context.req.valid("json" as never) as {
      podcastId: string;
      prompt?: string;
    };
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

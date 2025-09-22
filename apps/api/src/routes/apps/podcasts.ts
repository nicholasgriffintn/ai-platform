import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
  listPodcastsResponseSchema,
  podcastDetailResponseSchema,
  podcastGenerateImageSchema,
  podcastSummarizeSchema,
  podcastTranscribeSchema,
  apiResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { checkPlanRequirement } from "~/services/user/userOperations";
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

const app = new Hono();

const routeLogger = createRouteLogger("apps/podcasts");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

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
            schema: resolver(listPodcastsResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
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

      routeLogger.error("Error fetching podcasts:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to fetch podcasts",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

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
            schema: resolver(podcastDetailResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const id = context.req.param("id");
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
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

      routeLogger.error("Error fetching podcast:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
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
            schema: resolver(apiResponseSchema),
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

      const planCheck = checkPlanRequirement(user, "pro");
      if (!planCheck.isValid) {
        return context.json(
          {
            response: {
              status: "error",
              message: planCheck.message,
            },
          },
          401,
        );
      }

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
      routeLogger.error("Error uploading podcast:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
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
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", podcastTranscribeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

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
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", podcastSummarizeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastSummariseBody;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

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
            schema: resolver(apiResponseSchema),
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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

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

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  type ImageGenerationParams,
  generateImage,
} from "~/services/apps/generate/image";
import {
  type MusicGenerationParams,
  generateMusic,
} from "~/services/apps/generate/music";
import {
  type SpeechGenerationParams,
  generateSpeech,
} from "~/services/apps/generate/speech";
import {
  type VideoGenerationParams,
  generateVideo,
} from "~/services/apps/generate/video";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import {
  imageGenerationSchema,
  musicGenerationSchema,
  speechGenerationSchema,
  videoGenerationSchema,
} from "../schemas/apps";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_GENERATE");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.post(
  "/image",
  describeRoute({
    tags: ["apps"],
    description: "Generate an image",
    responses: {
      200: {
        description: "Generated image result",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
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
    },
  }),
  zValidator("json", imageGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as ImageGenerationParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
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

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const response = await generateImage({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/video",
  describeRoute({
    tags: ["apps"],
    description: "Generate a video",
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
  zValidator("json", videoGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as VideoGenerationParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
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

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const response = await generateVideo({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/music",
  describeRoute({
    tags: ["apps"],
    description: "Generate music",
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
  zValidator("json", musicGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as MusicGenerationParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

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

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const response = await generateMusic({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/speech",
  describeRoute({
    tags: ["apps"],
    description: "Generate speech from text",
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
  zValidator("json", speechGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as SpeechGenerationParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

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

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const response = await generateSpeech({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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

export default app;

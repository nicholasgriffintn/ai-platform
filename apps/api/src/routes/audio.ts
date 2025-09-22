import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleTextToSpeech } from "~/services/audio/speech";
import { handleTranscribe } from "~/services/audio/transcribe";
import type { IEnv } from "~/types";
import {
  textToSpeechSchema,
  transcribeFormSchema,
  transcribeQuerySchema,
} from "../schemas/audio";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("audio");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
  routeLogger.info(`Processing audio route: ${c.req.path}`);
  return next();
});

app.post(
  "/transcribe",
  describeRoute({
    tags: ["audio"],
    summary: "Create transcription",
    description: "Transcribes audio into the input language.",
    responses: {
      200: {
        description: "Transcription result with extracted text",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("query", transcribeQuerySchema),
  zValidator("form", transcribeFormSchema),
  async (context: Context) => {
    const { provider, timestamps } = context.req.valid("query" as never) as {
      provider?: "workers" | "mistral";
      timestamps?: boolean;
    };
    const { audio } = context.req.valid("form" as never) as {
      audio: File | Blob | string;
    };
    const user = context.get("user");

    const response = await handleTranscribe({
      env: context.env as IEnv,
      audio,
      provider,
      timestamps: timestamps === true,
      user,
    });

    return context.json({
      response,
    });
  },
);

// TODO: Expand this for more control over the output.
app.post(
  "/speech",
  describeRoute({
    tags: ["audio"],
    summary: "Create speech",
    description: "Generates audio from the input text.",
    responses: {
      200: {
        description: "Speech generation result with audio URL",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", textToSpeechSchema),
  async (context: Context) => {
    const { input, provider } = context.req.valid("json" as never) as {
      input: string;
      provider?: "polly" | "cartesia" | "elevenlabs";
    };
    const user = context.get("user");

    const response = await handleTextToSpeech({
      env: context.env as IEnv,
      input,
      provider,
      user,
    });

    return context.json({
      response,
    });
  },
);

// TODO: Add a route for translating audio.

export default app;

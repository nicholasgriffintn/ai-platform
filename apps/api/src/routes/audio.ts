import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleTextToSpeech } from "~/services/audio/speech";
import { handleTranscribe } from "~/services/audio/transcribe";
import type { IEnv } from "~/types";
import { textToSpeechSchema, transcribeFormSchema } from "./schemas/audio";
import { apiResponseSchema, errorResponseSchema } from "./schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("AUDIO");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
  routeLogger.info(`Processing audio route: ${c.req.path}`);
  return next();
});

// TODO: Expand this to be able to provide more capability for the model settings.
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
  zValidator("form", transcribeFormSchema),
  async (context: Context) => {
    const body = context.req.valid("form" as never) as {
      audio: Blob;
    };
    const user = context.get("user");

    const response = await handleTranscribe({
      env: context.env as IEnv,
      audio: body.audio as Blob,
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
    const body = context.req.valid("json" as never) as {
      input: string;
      provider?: "polly" | "cartesia" | "elevenlabs";
    };
    const user = context.get("user");

    const response = await handleTextToSpeech({
      env: context.env as IEnv,
      input: body.input,
      provider: body.provider,
      user,
    });

    return context.json({
      response,
    });
  },
);

// TODO: Add a route for translating audio.

export default app;

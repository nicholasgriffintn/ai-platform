import {
  apiResponseSchema,
  textToSpeechSchema,
  transcribeFormSchema,
  transcribeQuerySchema,
  transcriptionResponseSchema,
  errorResponseSchema,
  NO_STORE,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleTextToSpeech } from "~/services/audio/speech";
import { handleTranscribe } from "~/services/audio/transcribe";

const app = new Hono();

const routeLogger = createRouteLogger("audio");

app.use("/*", async (c, next) => {
  routeLogger.info(`Processing audio route: ${c.req.path}`);

  if (c.req.path.endsWith("/transcribe")) {
    c.header("Cache-Control", NO_STORE);
  }

  await next();

  if (c.req.path.endsWith("/transcribe")) {
    c.res.headers.set("Cache-Control", NO_STORE);
  }
});

addRoute(app, "post", "/transcribe", {
  tags: ["audio"],
  summary: "Create transcription",
  description: "Transcribes audio into the input language.",
  auth: true,
  formSchema: transcribeFormSchema,
  querySchema: transcribeQuerySchema,
  responses: {
    200: {
      description: "Transcription result with extracted text",
      schema: transcriptionResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ query, raw, serviceContext, user }) => {
    const { audio } = transcribeFormSchema.parse(raw.req.valid("form" as never));

    const response = await handleTranscribe({
      env: serviceContext.env,
      audio: { kind: "file", file: audio },
      provider: query.provider,
      timestamps: query.timestamps,
      user,
    });

    return { response };
  },
});

addRoute(app, "post", "/speech", {
  tags: ["audio"],
  summary: "Create speech",
  description: "Generates audio from the input text.",
  auth: "user-or-anonymous",
  bodySchema: textToSpeechSchema,
  responses: {
    200: {
      description: "Speech generation result with audio URL",
      schema: apiResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ body, serviceContext, user }) => {
    const response = await handleTextToSpeech({
      env: serviceContext.env,
      input: body.input,
      provider: body.provider,
      model: body.model,
      lang: body.lang,
      store: body.store,
      voice_id: body.voice_id,
      ref_audio: body.ref_audio,
      response_format: body.response_format,
      user,
      context: serviceContext,
    });

    return { response };
  },
});

export default app;

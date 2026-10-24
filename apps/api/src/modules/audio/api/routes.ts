import {
  apiResponseSchema,
  createSpeechVoiceFormSchema,
  speechModelListResponseSchema,
  speechVoiceListResponseSchema,
  speechVoiceResponseSchema,
  textToSpeechSchema,
  transcribeFormSchema,
  transcribeQuerySchema,
  transcriptionResponseSchema,
  errorResponseSchema,
  NO_STORE,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { checkSpeechAccess } from "~/modules/audio/application/access";
import { handleTextToSpeech } from "~/modules/audio/application/speech";
import { handleTranscribe } from "~/modules/audio/application/transcribe";
import {
  createSpeechVoice,
  deleteSpeechVoice,
  listSpeechVoices,
} from "~/modules/audio/application/voices";
import { rankSpeechModels } from "~/modules/models/application/resolve";

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
  handler: async ({ body, serviceContext, user, anonymousUser }) => {
    await checkSpeechAccess({
      repositories: serviceContext.repositories,
      user,
      anonymousUser,
      provider: body.provider,
    });

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
      expressiveness: body.expressiveness,
      user,
      context: serviceContext,
    });

    return { response };
  },
});

addRoute(app, "get", "/speech/models", {
  tags: ["audio"],
  summary: "List speech models",
  description:
    "Lists the speech models you can use, best first by text-to-speech arena score. The first one is what Polychat picks when you leave speech on automatic.",
  auth: true,
  responses: {
    200: { description: "Ranked speech models", schema: speechModelListResponseSchema },
  },
  handler: async ({ serviceContext, user }) => ({
    models: (await rankSpeechModels(serviceContext.env, user)).map(
      ({ id, name, provider, arenaScore }) => ({ id, name, provider, arenaScore }),
    ),
  }),
});

addRoute(app, "get", "/voices", {
  tags: ["audio"],
  summary: "List saved voices",
  description: "Lists the speech voices you saved from your own recordings.",
  auth: true,
  responses: {
    200: { description: "Saved voices", schema: speechVoiceListResponseSchema },
  },
  handler: async ({ serviceContext, user }) => ({
    voices: await listSpeechVoices(serviceContext.env, user),
  }),
});

addRoute(app, "post", "/voices", {
  tags: ["audio"],
  summary: "Save a voice",
  description:
    "Clones a voice from an MP3 or WAV recording and saves it for speech. Confirm the voice is yours or you have permission to use it.",
  auth: true,
  formSchema: createSpeechVoiceFormSchema,
  responses: {
    200: { description: "Saved voice", schema: speechVoiceResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ raw, serviceContext, user }) => {
    const form = createSpeechVoiceFormSchema.parse(raw.req.valid("form" as never));

    return {
      voice: await createSpeechVoice({
        env: serviceContext.env,
        user,
        name: form.name,
        sample: form.sample,
      }),
    };
  },
});

addRoute(app, "delete", "/voices/:voice_id", {
  tags: ["audio"],
  summary: "Delete a saved voice",
  auth: true,
  paramSchema: z.object({ voice_id: z.string().min(1).max(128) }),
  responses: {
    200: { description: "Deleted", schema: z.object({ deleted: z.literal(true) }) },
    404: { description: "Voice not found", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) => {
    await deleteSpeechVoice({
      env: serviceContext.env,
      user,
      voiceId: params.voice_id,
    });

    return { deleted: true as const };
  },
});

export default app;

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod/v4";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IEnv } from "~/types";
import { AIProviderFactory } from "../lib/providers/factory";
import { errorResponseSchema } from "./schemas/shared";

const realtimeSessionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  modalities: z.array(z.string()),
  turn_detection: z.object({
    type: z.string(),
    threshold: z.number(),
    prefix_padding_ms: z.number(),
    silence_duration_ms: z.number(),
  }),
  input_audio_format: z.string(),
  input_audio_transcription: z.object({
    model: z.string(),
    language: z.string(),
    language_code: z.string(),
  }),
  client_secret: z.object({
    expires_at: z.number(),
    value: z.string(),
  }),
});

const app = new Hono();
const routeLogger = createRouteLogger("REALTIME");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing realtime route: ${c.req.path}`);
  return next();
});

app.post(
  "/session/:type",
  describeRoute({
    tags: ["realtime", "session"],
    summary: "Create a new realtime session",
    responses: {
      200: {
        description: "Realtime session created",
        content: {
          "application/json": {
            schema: resolver(realtimeSessionResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const env = c.env as IEnv;
    const user = c.get("user");
    const type = c.req.param("type");
    const model = c.req.param("model") || "gpt-4o-mini-transcribe";

    const availableModels = [
      "gpt-4o-mini-transcribe",
      "gpt-4o-transcribe",
      "whisper",
    ];

    if (!availableModels.includes(model)) {
      return c.json({ error: "Invalid model specified" }, 400);
    }

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (type !== "transcription") {
      return c.json({ error: "Invalid session type" }, 400);
    }

    const body: Record<string, any> = {};

    if (type === "transcription") {
      body.input_audio_transcription = {
        model,
        language: "en",
      };
      body.turn_detection = {
        type: "server_vad",
        threshold: 0.4,
        prefix_padding_ms: 400,
        silence_duration_ms: 1000,
      };
    }

    const provider = AIProviderFactory.getProvider("openai");
    const session = await provider.createRealtimeSession(env, user, type, body);

    if (!session) {
      return c.json({ error: "Failed to create realtime session" }, 500);
    }

    return c.json({ success: true, data: session });
  },
);

export default app;

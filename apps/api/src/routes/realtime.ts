import { type Context, Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import {
  errorResponseSchema,
  realtimeSessionResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IEnv } from "~/types";
import { AIProviderFactory } from "../lib/providers/factory";

const app = new Hono();
const routeLogger = createRouteLogger("realtime");

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
    const model = c.req.query("model") || "gpt-4o-mini-transcribe";

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

    return c.json(session);
  },
);

export default app;

import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";
import {
	textToSpeechSchema,
	transcribeFormSchema,
	transcribeQuerySchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { handleTextToSpeech } from "~/services/audio/speech";
import { handleTranscribe } from "~/services/audio/transcribe";
import type { IEnv } from "~/types";

const app = new Hono();

const routeLogger = createRouteLogger("audio");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
	routeLogger.info(`Processing audio route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/transcribe", {
	tags: ["audio"],
	summary: "Create transcription",
	description: "Transcribes audio into the input language.",
	formSchema: transcribeFormSchema,
	querySchema: transcribeQuerySchema,
	responses: {
		200: {
			description: "Transcription result with extracted text",
			schema: apiResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
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

			return ResponseFactory.success(context, {
				response,
			});
		})(raw),
});

// TODO: Expand this for more control over the output.
addRoute(app, "post", "/speech", {
	tags: ["audio"],
	summary: "Create speech",
	description: "Generates audio from the input text.",
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
	handler: async ({ raw }) =>
		(async (context: Context) => {
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

			return ResponseFactory.success(context, {
				response,
			});
		})(raw),
});

// TODO: Add a route for translating audio.

export default app;

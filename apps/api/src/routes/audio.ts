import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import {
	textToSpeechSchema,
	transcribeFormSchema,
	transcribeQuerySchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleTextToSpeech } from "~/services/audio/speech";
import { handleTranscribe } from "~/services/audio/transcribe";

const app = new Hono();

const routeLogger = createRouteLogger("audio");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing audio route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/transcribe", {
	tags: ["audio"],
	summary: "Create transcription",
	description: "Transcribes audio into the input language.",
	auth: "user-or-anonymous",
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
	handler: async ({ query, raw, serviceContext, user }) => {
		const { audio } = raw.req.valid("form" as never) as {
			audio: File | Blob | string;
		};

		const response = await handleTranscribe({
			env: serviceContext.env,
			audio,
			provider: query.provider,
			timestamps: query.timestamps === true,
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

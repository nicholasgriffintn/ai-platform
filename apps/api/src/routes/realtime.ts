import { type Context, Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import {
	errorResponseSchema,
	REALTIME_LIVE_PROVIDER_MANIFEST,
	realtimeLiveProviderManifestResponseSchema,
	realtimePipelineSessionCreateSchema,
	realtimePipelineSessionResponseSchema,
	realtimeSessionResponseSchema,
} from "@assistant/schemas";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { IEnv, IUser } from "~/types";
import {
	getRealtimeProvider,
	listRealtimeProviders,
	parseRealtimeModalities,
	parseRealtimeTransport,
	type RealtimeTranscriptionDelay,
} from "~/lib/providers/capabilities/realtime";
import { userCanAccessRealtimeModel } from "~/services/realtime/access";
import { createCartesiaRealtimeProxyResponse } from "~/services/realtime/cartesia";
import { createElevenLabsRealtimeProxyResponse } from "~/services/realtime/elevenlabs";
import { createMistralRealtimeProxyResponse } from "~/services/realtime/mistral";
import { createRealtimePipelineSession } from "~/services/realtime/pipeline";

const app = new Hono();
const routeLogger = createRouteLogger("realtime");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing realtime route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/providers", {
	tags: ["realtime"],
	summary: "List realtime live providers",
	responses: {
		200: {
			description: "Realtime live provider manifest",
			schema: realtimeLiveProviderManifestResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			return ResponseFactory.success(c, {
				providers: REALTIME_LIVE_PROVIDER_MANIFEST,
			});
		})(raw),
});

addRoute(app, "post", "/session/:type", {
	tags: ["realtime"],
	summary: "Create a new realtime session",
	responses: {
		200: {
			description: "Realtime session created",
			schema: realtimeSessionResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const env = c.env as IEnv;
			const user = c.get("user");
			const type = c.req.param("type");
			const model = c.req.query("model");
			const language = c.req.query("language");
			const sourceLanguage = c.req.query("source_language");
			const targetLanguage = c.req.query("target_language");
			const voice = c.req.query("voice");
			const instructions = c.req.query("instructions");
			const delay = c.req.query("delay") as RealtimeTranscriptionDelay | undefined;
			const transportQuery = c.req.query("transport");
			const inputModalitiesQuery = c.req.query("input_modalities");
			const outputModalitiesQuery =
				c.req.query("output_modalities") ||
				c.req.query("response_modalities") ||
				c.req.query("modalities");
			const providerName = c.req.query("provider") || "openai";

			if (!user?.id) {
				return ResponseFactory.error(c, "Unauthorized", 401);
			}

			if (type !== "realtime" && type !== "translation" && type !== "transcription") {
				return ResponseFactory.error(c, "Invalid session type", 400);
			}

			if (!listRealtimeProviders().includes(providerName)) {
				return ResponseFactory.error(c, "Invalid provider specified", 400);
			}

			const provider = getRealtimeProvider(providerName, { env, user });
			if (model && provider.models && !provider.models.includes(model)) {
				return ResponseFactory.error(c, "Invalid model specified", 400);
			}

			let requestedModel = model;
			if (!requestedModel) {
				try {
					requestedModel = provider.getDefaultModel(type);
				} catch (error) {
					return ResponseFactory.error(
						c,
						error instanceof Error ? error.message : "Invalid session type",
						400,
					);
				}
			}

			if (
				!(await userCanAccessRealtimeModel({
					env,
					userId: user.id,
					model: requestedModel,
				}))
			) {
				return ResponseFactory.error(c, "Model not found or user does not have access", 403);
			}

			const transport = parseRealtimeTransport(transportQuery);
			const inputModalities = parseRealtimeModalities(inputModalitiesQuery);
			const outputModalities = parseRealtimeModalities(outputModalitiesQuery);

			const session = await provider.createSession({
				env,
				user,
				type,
				model,
				language,
				sourceLanguage,
				targetLanguage,
				voice,
				instructions,
				delay,
				transport,
				inputModalities,
				outputModalities,
			});

			if (!session) {
				return ResponseFactory.error(c, "Failed to create realtime session", 500);
			}

			return ResponseFactory.success(c, session);
		})(raw),
});

addRoute(app, "post", "/pipeline/session", {
	tags: ["realtime"],
	summary: "Create a composed realtime pipeline session",
	auth: true,
	bodySchema: realtimePipelineSessionCreateSchema,
	responses: {
		200: {
			description: "Composed realtime pipeline session created",
			schema: realtimePipelineSessionResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		403: { description: "Model access denied", schema: errorResponseSchema },
	},
	handler: async ({ body, raw, serviceContext, user }) =>
		(async (c: Context) => {
			const providers = listRealtimeProviders();

			if (!providers.includes(body.input.provider)) {
				return ResponseFactory.error(c, "Invalid input provider specified", 400);
			}

			const result = await createRealtimePipelineSession({
				env: serviceContext.env,
				request: body,
				user,
			});

			if (result.ok === false) {
				return ResponseFactory.error(c, result.message, result.status);
			}

			return ResponseFactory.success(c, result.session);
		})(raw),
});

app.get("/mistral/transcription", async (c: Context) => {
	const env = c.env as IEnv;
	const user = c.get("user") as IUser | undefined;

	if (!user?.id) {
		return ResponseFactory.error(c, "Unauthorized", 401);
	}

	const model = c.req.query("model");
	const delay = c.req.query("delay") as RealtimeTranscriptionDelay | undefined;

	return createMistralRealtimeProxyResponse({
		context: c,
		delay,
		env,
		user,
		model,
	});
});

app.get("/elevenlabs/transcription", async (c: Context) => {
	const env = c.env as IEnv;
	const user = c.get("user") as IUser | undefined;

	if (!user?.id) {
		return ResponseFactory.error(c, "Unauthorized", 401);
	}

	return createElevenLabsRealtimeProxyResponse({
		context: c,
		env,
		user,
		model: c.req.query("model"),
		language: c.req.query("language"),
	});
});

app.get("/cartesia/transcription", async (c: Context) => {
	const env = c.env as IEnv;
	const user = c.get("user") as IUser | undefined;

	if (!user?.id) {
		return ResponseFactory.error(c, "Unauthorized", 401);
	}

	return createCartesiaRealtimeProxyResponse({
		context: c,
		env,
		user,
		model: c.req.query("model"),
		language: c.req.query("language"),
	});
});

export default app;

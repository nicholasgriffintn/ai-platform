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
	parseRealtimeTranscriptionDelay,
	parseRealtimeTransport,
} from "~/lib/providers/capabilities/realtime";
import { userCanAccessRealtimeModel } from "~/services/realtime/access";
import { createCartesiaRealtimeProxyResponse } from "~/services/realtime/cartesia";
import { createElevenLabsRealtimeProxyResponse } from "~/services/realtime/elevenlabs";
import { createMistralRealtimeProxyResponse } from "~/services/realtime/mistral";
import { createRealtimePipelineSession } from "~/services/realtime/pipeline";

const app = new Hono<{
	Bindings: IEnv;
	Variables: {
		user?: IUser;
	};
}>();
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
	handler: async () => ({
		providers: REALTIME_LIVE_PROVIDER_MANIFEST,
	}),
});

addRoute(app, "post", "/session/:type", {
	tags: ["realtime"],
	summary: "Create a new realtime session",
	auth: true,
	responses: {
		200: {
			description: "Realtime session created",
			schema: realtimeSessionResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
	},
	handler: async ({ raw, serviceContext, user }) => {
		const env = serviceContext.env;
		const type = raw.req.param("type");
		const model = raw.req.query("model");
		const language = raw.req.query("language");
		const sourceLanguage = raw.req.query("source_language");
		const targetLanguage = raw.req.query("target_language");
		const voice = raw.req.query("voice");
		const instructions = raw.req.query("instructions");
		const delay = parseRealtimeTranscriptionDelay(raw.req.query("delay"));
		const transportQuery = raw.req.query("transport");
		const inputModalitiesQuery = raw.req.query("input_modalities");
		const outputModalitiesQuery =
			raw.req.query("output_modalities") ||
			raw.req.query("response_modalities") ||
			raw.req.query("modalities");
		const providerName = raw.req.query("provider") || "openai";

		if (type !== "realtime" && type !== "translation" && type !== "transcription") {
			return ResponseFactory.error(raw, "Invalid session type", 400);
		}

		if (!listRealtimeProviders().includes(providerName)) {
			return ResponseFactory.error(raw, "Invalid provider specified", 400);
		}

		const provider = getRealtimeProvider(providerName, { env, user });
		if (model && provider.models && !provider.models.includes(model)) {
			return ResponseFactory.error(raw, "Invalid model specified", 400);
		}

		let requestedModel = model;
		if (!requestedModel) {
			try {
				requestedModel = provider.getDefaultModel(type);
			} catch (error) {
				return ResponseFactory.error(
					raw,
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
			return ResponseFactory.error(raw, "Model not found or user does not have access", 403);
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
			return ResponseFactory.error(raw, "Failed to create realtime session", 500);
		}

		return session;
	},
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
	handler: async ({ body, raw, serviceContext, user }) => {
		const result = await createRealtimePipelineSession({
			env: serviceContext.env,
			request: body,
			user,
		});

		if (result.ok === false) {
			return ResponseFactory.error(raw, result.message, result.status);
		}

		return result.session;
	},
});

app.get("/mistral/transcription", async (c) => {
	const env = c.env;
	const user = c.get("user");

	if (!user?.id) {
		return ResponseFactory.error(c, "Unauthorized", 401);
	}

	const model = c.req.query("model");
	const delay = parseRealtimeTranscriptionDelay(c.req.query("delay"));

	return createMistralRealtimeProxyResponse({
		context: c,
		delay,
		env,
		user,
		model,
	});
});

app.get("/elevenlabs/transcription", async (c) => {
	const env = c.env;
	const user = c.get("user");

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

app.get("/cartesia/transcription", async (c) => {
	const env = c.env;
	const user = c.get("user");

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

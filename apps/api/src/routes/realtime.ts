import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { errorResponseSchema, realtimeSessionResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { IEnv } from "~/types";
import {
	getRealtimeProvider,
	listRealtimeProviders,
	type RealtimeTranscriptionDelay,
} from "~/lib/providers/capabilities/realtime";

const app = new Hono();
const routeLogger = createRouteLogger("realtime");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing realtime route: ${c.req.path}`);
	return next();
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
			});

			if (!session) {
				return ResponseFactory.error(c, "Failed to create realtime session", 500);
			}

			return ResponseFactory.success(c, session);
		})(raw),
});

export default app;

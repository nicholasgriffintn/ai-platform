import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	promptCoachJsonSchema,
	promptCoachResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { handlePromptCoachSuggestion } from "~/services/apps/prompt-coach";
import type { IEnv, IUser } from "~/types";
import articles from "./articles";
import drawing from "./drawing";
import embeddings from "./embeddings";
import notes from "./notes";
import podcasts from "./podcasts";
import retrieval from "./retrieval";
import shared from "./shared";
import replicate from "./replicate";
import canvas from "./canvas";
import strudel from "./strudel";
import sandbox from "./sandbox";

const app = new Hono();

const routeLogger = createRouteLogger("apps");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

app.use("/*", requireAuth);

app.route("/embeddings", embeddings);

app.route("/drawing", drawing);

app.route("/podcasts", podcasts);

app.route("/articles", articles);

app.route("/notes", notes);

app.route("/retrieval", retrieval);

app.route("/replicate", replicate);

app.route("/canvas", canvas);

app.route("/strudel", strudel);

app.route("/sandbox", sandbox);

addRoute(app, "post", "/prompt-coach", {
	tags: ["chat"],
	summary: "Get prompt suggestion using coaching system",
	description:
		"Takes a user prompt, runs it through the existing coaching system prompt, and returns the suggested revised prompt.",
	bodySchema: promptCoachJsonSchema,
	responses: {
		200: {
			description: "Suggested revised prompt extracted from AI response",
			schema: promptCoachResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		500: {
			description:
				"Internal server error during suggestion generation or extraction",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { prompt: userPrompt } = context.req.valid("json" as never) as {
				prompt: string;
			};
			const userContext = context.get("user") as IUser | undefined;
			const env = context.env as IEnv;

			const result = await handlePromptCoachSuggestion({
				env,
				user: userContext,
				prompt: userPrompt,
			});

			return ResponseFactory.success(context, result);
		})(raw),
});

app.route("/shared", shared);

export default app;

import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { errorResponseSchema, uploadResponseSchema } from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { handleFileUpload } from "~/services/uploads";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv } from "../types";

const app = new Hono();
const routeLogger = createRouteLogger("uploads");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
	routeLogger.info(`Processing uploads route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/", {
	tags: ["uploads"],
	summary: "Upload file",
	description: "Upload an image, audio, code, or document to the server",
	responses: {
		200: {
			description: "File upload successful, returns the URL",
			schema: uploadResponseSchema,
		},
		400: {
			description: "Bad request or invalid file",
			schema: errorResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		500: {
			description: "Server error or storage failure",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const env = context.env as IEnv;

			let formData: FormData;
			try {
				formData = await context.req.formData();
			} catch {
				throw new AssistantError(
					"Failed to parse upload data",
					ErrorType.PARAMS_ERROR,
					400,
				);
			}

			const user = context.get("user");
			const userId = user?.id;

			const response = await handleFileUpload(env, userId, formData);
			return ResponseFactory.success(context, response);
		})(raw),
});

export default app;

import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import { errorResponseSchema, uploadResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleFileUpload } from "~/services/uploads";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();
const routeLogger = createRouteLogger("uploads");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing uploads route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/", {
	tags: ["uploads"],
	summary: "Upload file",
	description: "Upload an image, audio, code, or document to the server",
	auth: true,
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
	handler: async ({ raw, serviceContext, user }) => {
		let formData: FormData;
		try {
			formData = await raw.req.formData();
		} catch {
			throw new AssistantError("Failed to parse upload data", ErrorType.PARAMS_ERROR, 400);
		}

		return handleFileUpload(serviceContext, user.id, formData);
	},
});

export default app;

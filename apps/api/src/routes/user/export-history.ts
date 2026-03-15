import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { errorResponseSchema } from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { User } from "~/types";
import { handleExportChatHistory } from "~/services/user/exportChatHistory";

const app = new Hono();

app.use("*", requireAuth);

addRoute(app, "get", "/", {
	tags: ["user"],
	summary: "Export chat history as JSON",
	description: "Returns a JSON file containing the user's chat history.",
	responses: {
		200: { description: "JSON file stream with chat history" },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as User | undefined;
			if (!user?.id) {
				return ResponseFactory.success(
					c,
					{ error: "Authentication required", type: "AUTHENTICATION_ERROR" },
					401,
				);
			}

			try {
				const serviceContext = getServiceContext(c);

				const json = await handleExportChatHistory({
					context: serviceContext,
					env: c.env,
					user: user,
				});

				const ts = new Date().toISOString().replace(/[:.]/g, "-");
				const filename = `chat-history-${ts}.json`;

				return new Response(JSON.stringify(json, null, 2), {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Content-Disposition": `attachment; filename="${filename}"`,
						"Cache-Control": "no-store",
					},
				});
			} catch (error: any) {
				return ResponseFactory.success(
					c,
					{
						error: error?.message || "Failed to export chat history",
						type: "UNKNOWN_ERROR",
					},
					500,
				);
			}
		})(raw),
});

export default app;

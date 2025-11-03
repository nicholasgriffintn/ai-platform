import { type Context, Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { errorResponseSchema } from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import type { User } from "~/types";
import { handleExportChatHistory } from "~/services/user/exportChatHistory";

const app = new Hono();

app.use("*", requireAuth);

app.get(
	"/",
	describeRoute({
		tags: ["user"],
		summary: "Export chat history as JSON",
		description: "Returns a JSON file containing the user's chat history.",
		responses: {
			200: {
				description: "JSON file stream with chat history",
				content: {
					"application/json": { schema: { type: "string", format: "binary" } },
				},
			},
			401: {
				description: "Authentication required",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	async (c: Context) => {
		const user = c.get("user") as User | undefined;
		if (!user?.id) {
			return c.json(
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
					"Content-Disposition": `attachment; filename=\"${filename}\"`,
					"Cache-Control": "no-store",
				},
			});
		} catch (error: any) {
			return c.json(
				{
					error: error?.message || "Failed to export chat history",
					type: "UNKNOWN_ERROR",
				},
				500,
			);
		}
	},
);

export default app;

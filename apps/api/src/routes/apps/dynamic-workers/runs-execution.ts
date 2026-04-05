import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	executeDynamicWorkerRunSchema,
	type ExecuteDynamicWorkerRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuthenticatedUser } from "~/lib/http/auth";
import { executeDynamicWorkerRunStream } from "~/services/apps/dynamic-workers/execute-stream";

export function registerDynamicWorkerRunExecutionRoutes(app: Hono): void {
	addRoute(app, "post", "/runs/execute-stream", {
		tags: ["apps"],
		description: "Execute a Dynamic Worker run with streaming output",
		bodySchema: executeDynamicWorkerRunSchema,
		responses: {
			200: { description: "Dynamic Worker run executed successfully" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const serviceContext = getServiceContext(c);
				const payload = c.req.valid(
					"json" as never,
				) as ExecuteDynamicWorkerRunPayload;
				return executeDynamicWorkerRunStream({
					env: c.env,
					context: serviceContext,
					user,
					payload,
				});
			})(raw),
	});
}

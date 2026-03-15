import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	executeSandboxRunSchema,
	type ExecuteSandboxRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { IUser } from "~/types";

export function registerSandboxRunExecutionRoutes(app: Hono): void {
	addRoute(app, "post", "/runs/execute-stream", {
		tags: ["apps"],
		description: "Execute a Sandbox run with streaming output",
		bodySchema: executeSandboxRunSchema,
		responses: {
			200: { description: "Sandbox run executed successfully" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = c.get("user") as IUser;
				const serviceContext = getServiceContext(c);
				const payload = c.req.valid(
					"json" as never,
				) as ExecuteSandboxRunPayload;
				return executeSandboxRunStream({
					env: c.env,
					context: serviceContext,
					user,
					payload,
				});
			})(raw),
	});
}

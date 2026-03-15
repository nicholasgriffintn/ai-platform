import { type Context, type Hono } from "hono";
import { validator as zValidator, describeRoute } from "hono-openapi";
import {
	executeSandboxRunSchema,
	type ExecuteSandboxRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { IUser } from "~/types";

export function registerSandboxRunExecutionRoutes(app: Hono): void {
	app.post(
		"/runs/execute-stream",
		describeRoute({
			tags: ["apps"],
			description: "Execute a Sandbox run with streaming output",
			responses: {
				200: {
					description: "Sandbox run executed successfully",
					content: { "text/event-stream": {} },
				},
			},
		}),
		zValidator("json", executeSandboxRunSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const serviceContext = getServiceContext(c);
			const payload = c.req.valid("json" as never) as ExecuteSandboxRunPayload;
			return executeSandboxRunStream({
				env: c.env,
				context: serviceContext,
				user,
				payload,
			});
		},
	);
}

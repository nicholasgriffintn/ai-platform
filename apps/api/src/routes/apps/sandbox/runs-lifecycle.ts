import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	listRunInstructionsQuerySchema,
	sandboxRunParamsSchema,
	submitRunInstructionSchema,
	type ListRunInstructionsQueryPayload,
	type SubmitRunInstructionPayload,
	type SandboxRunParams,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuthenticatedUser } from "~/lib/http/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getSandboxRunControlState,
	listSandboxRunInstructionsForUser,
	requestSandboxRunInstruction,
} from "~/services/apps/sandbox/runs";

export function registerSandboxRunLifecycleRoutes(app: Hono): void {
	addRoute(app, "get", "/runs/:runId/instructions", {
		tags: ["apps"],
		paramSchema: sandboxRunParamsSchema,
		querySchema: listRunInstructionsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const query = c.req.valid("query" as never) as ListRunInstructionsQueryPayload;
				const instructions = await listSandboxRunInstructionsForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					after: query.after,
				});
				return ResponseFactory.success(c, { instructions });
			})(raw),
	});

	addRoute(app, "post", "/runs/:runId/instructions", {
		tags: ["apps"],
		description: "Submit an operator instruction to a running sandbox run",
		bodySchema: submitRunInstructionSchema,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Instruction accepted" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const payload = c.req.valid("json" as never) as SubmitRunInstructionPayload;
				const instruction = await requestSandboxRunInstruction({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					kind: payload.kind,
					content: payload.content,
					command: payload.command,
					requestId: payload.requestId,
					approvalStatus: payload.approvalStatus,
					timeoutSeconds: payload.timeoutSeconds,
					escalateAfterSeconds: payload.escalateAfterSeconds,
				});
				return ResponseFactory.success(c, { instruction });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/control", {
		tags: ["apps"],
		description: "Get run execution control state for worker coordination",
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Sandbox run control state" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const control = await getSandboxRunControlState({
					context: getServiceContext(c),
					userId: user.id,
					runId,
				});
				return ResponseFactory.success(c, control);
			})(raw),
	});
}

import { addRoute } from "~/lib/http/routeBuilder";
import { type Hono } from "hono";

import {
	listRunInstructionsQuerySchema,
	sandboxRunParamsSchema,
	submitRunInstructionSchema,
} from "@assistant/schemas";

import {
	getSandboxRunControlState,
	listSandboxRunInstructionsForUser,
	requestSandboxRunInstruction,
} from "~/services/apps/sandbox/runs";

export function registerSandboxRunLifecycleRoutes(app: Hono): void {
	addRoute(app, "get", "/runs/:runId/instructions", {
		tags: ["apps"],
		auth: true,
		paramSchema: sandboxRunParamsSchema,
		querySchema: listRunInstructionsQuerySchema,
		handler: async ({ params, query, serviceContext, user }) => {
			const instructions = await listSandboxRunInstructionsForUser({
				context: serviceContext,
				userId: user.id,
				runId: params.runId,
				after: query.after,
			});
			return { instructions };
		},
	});

	addRoute(app, "post", "/runs/:runId/instructions", {
		tags: ["apps"],
		description: "Submit an operator instruction to a running sandbox run",
		auth: true,
		bodySchema: submitRunInstructionSchema,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Instruction accepted" },
		},
		handler: async ({ body, params, serviceContext, user }) => {
			const instruction = await requestSandboxRunInstruction({
				context: serviceContext,
				userId: user.id,
				runId: params.runId,
				kind: body.kind,
				content: body.content,
				command: body.command,
				requestId: body.requestId,
				approvalStatus: body.approvalStatus,
				timeoutSeconds: body.timeoutSeconds,
				escalateAfterSeconds: body.escalateAfterSeconds,
			});
			return { instruction };
		},
	});

	addRoute(app, "get", "/runs/:runId/control", {
		tags: ["apps"],
		description: "Get run execution control state for worker coordination",
		auth: true,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Sandbox run control state" },
		},
		handler: async ({ params, serviceContext, user }) =>
			getSandboxRunControlState({
				context: serviceContext,
				userId: user.id,
				runId: params.runId,
			}),
	});
}

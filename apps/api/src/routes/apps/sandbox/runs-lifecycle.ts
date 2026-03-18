import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	cancelRunSchema,
	errorResponseSchema,
	listRunEventsQuerySchema,
	listRunInstructionsQuerySchema,
	listRunsQuerySchema,
	pauseRunSchema,
	resumeRunSchema,
	sandboxRunParamsSchema,
	submitRunInstructionSchema,
	type CancelRunPayload,
	type ListRunEventsQueryPayload,
	type ListRunInstructionsQueryPayload,
	type ListRunsQueryPayload,
	type PauseRunPayload,
	type ResumeRunPayload,
	type SubmitRunInstructionPayload,
	type SandboxRunParams,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuthenticatedUser } from "~/lib/http/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { sseResponse } from "~/lib/http/streaming";
import {
	getSandboxRunControlState,
	getSandboxRunForUser,
	listSandboxRunEventsForUser,
	listSandboxRunInstructionsForUser,
	listSandboxRunsForUser,
	requestSandboxRunCancellation,
	requestSandboxRunInstruction,
	requestSandboxRunPause,
	requestSandboxRunResume,
} from "~/services/apps/sandbox/runs";
import { createCoordinatorEventSseStream } from "~/services/apps/sandbox/streaming";
import { openRunCoordinatorEventsSocket } from "~/services/apps/sandbox/run-coordinator";

export function registerSandboxRunLifecycleRoutes(app: Hono): void {
	addRoute(app, "get", "/runs", {
		tags: ["apps"],
		description:
			"List user's GitHub App runs with optional filtering by installation and repo",
		querySchema: listRunsQuerySchema,
		responses: {
			200: { description: "List of GitHub App runs" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const payload = c.req.valid("query" as never) as ListRunsQueryPayload;
				const serviceContext = getServiceContext(c);
				const runs = await listSandboxRunsForUser({
					context: serviceContext,
					userId: user.id,
					installationId: payload.installationId,
					repo: payload.repo,
					limit: payload.limit,
				});
				return ResponseFactory.success(c, { runs });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId", {
		tags: ["apps"],
		description: "Get details of a specific GitHub App run",
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Details of a specific GitHub App run" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const run = await getSandboxRunForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
				});
				return ResponseFactory.success(c, { run });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/events", {
		tags: ["apps"],
		paramSchema: sandboxRunParamsSchema,
		querySchema: listRunEventsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const query = c.req.valid(
					"query" as never,
				) as ListRunEventsQueryPayload;
				const events = await listSandboxRunEventsForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					after: query.after,
				});
				return ResponseFactory.success(c, { events });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/instructions", {
		tags: ["apps"],
		paramSchema: sandboxRunParamsSchema,
		querySchema: listRunInstructionsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const query = c.req.valid(
					"query" as never,
				) as ListRunInstructionsQueryPayload;
				const instructions = await listSandboxRunInstructionsForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					after: query.after,
				});
				return ResponseFactory.success(c, { instructions });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/events/stream", {
		tags: ["apps"],
		paramSchema: sandboxRunParamsSchema,
		querySchema: listRunEventsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const query = c.req.valid(
					"query" as never,
				) as ListRunEventsQueryPayload;

				const context = getServiceContext(c);
				const stream = createCoordinatorEventSseStream({
					signal: c.req.raw.signal,
					initialAfter: query.after ?? 0,
					openSocket: () =>
						openRunCoordinatorEventsSocket({
							env: c.env,
							runId,
						}),
					listEvents: (after) =>
						listSandboxRunEventsForUser({
							context,
							userId: user.id,
							runId,
							after,
						}),
				});

				return sseResponse(stream);
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/events/ws", {
		tags: ["apps"],
		paramSchema: sandboxRunParamsSchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				await getSandboxRunForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
				});

				if (!c.env.SANDBOX_RUN_COORDINATOR) {
					return c.json({ error: "Run coordinator is not configured" }, 503);
				}
				if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
					return c.json({ error: "Expected websocket upgrade request" }, 426);
				}

				const id = c.env.SANDBOX_RUN_COORDINATOR.idFromName(runId);
				const stub = c.env.SANDBOX_RUN_COORDINATOR.get(id);
				return stub.fetch(
					"https://sandbox-run-coordinator/events/ws",
					c.req.raw,
				);
			})(raw),
	});

	addRoute(app, "post", "/runs/:runId/pause", {
		tags: ["apps"],
		description: "Pause a running sandbox run",
		bodySchema: pauseRunSchema,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Sandbox run pause was processed" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const payload = c.req.valid("json" as never) as PauseRunPayload;
				const result = await requestSandboxRunPause({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					reason: payload.reason,
				});
				return ResponseFactory.success(c, result);
			})(raw),
	});

	addRoute(app, "post", "/runs/:runId/resume", {
		tags: ["apps"],
		description: "Resume a paused sandbox run",
		bodySchema: resumeRunSchema,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Sandbox run resume was processed" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const payload = c.req.valid("json" as never) as ResumeRunPayload;
				const result = await requestSandboxRunResume({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					reason: payload.reason,
				});
				return ResponseFactory.success(c, result);
			})(raw),
	});

	addRoute(app, "post", "/runs/:runId/cancel", {
		tags: ["apps"],
		description: "Cancel a running sandbox run",
		bodySchema: cancelRunSchema,
		paramSchema: sandboxRunParamsSchema,
		responses: {
			200: { description: "Sandbox run cancellation was processed" },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid("param" as never) as SandboxRunParams;
				const payload = c.req.valid("json" as never) as CancelRunPayload;
				const result = await requestSandboxRunCancellation({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					reason: payload.reason,
				});
				return ResponseFactory.success(c, result);
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
				const payload = c.req.valid(
					"json" as never,
				) as SubmitRunInstructionPayload;
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

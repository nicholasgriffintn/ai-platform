import { type Context, type Hono } from "hono";
import { validator as zValidator, describeRoute, resolver } from "hono-openapi";
import {
	cancelRunSchema,
	errorResponseSchema,
	listRunEventsQuerySchema,
	listRunsQuerySchema,
	pauseRunSchema,
	resumeRunSchema,
	sandboxRunParamsSchema,
	type CancelRunPayload,
	type ListRunEventsQueryPayload,
	type ListRunsQueryPayload,
	type PauseRunPayload,
	type ResumeRunPayload,
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
	listSandboxRunsForUser,
	requestSandboxRunCancellation,
	requestSandboxRunPause,
	requestSandboxRunResume,
} from "~/services/apps/sandbox/runs";
import { createCoordinatorEventSseStream } from "~/services/apps/sandbox/streaming";
import { openRunCoordinatorEventsSocket } from "~/services/apps/sandbox/run-coordinator";

export function registerSandboxRunLifecycleRoutes(app: Hono): void {
	app.get(
		"/runs",
		describeRoute({
			tags: ["apps"],
			description:
				"List user's GitHub App runs with optional filtering by installation and repo",
			responses: {
				200: {
					description: "List of GitHub App runs",
					content: { "application/json": {} },
				},
				401: {
					description: "Unauthorized",
					content: {
						"application/json": { schema: resolver(errorResponseSchema) },
					},
				},
			},
		}),
		zValidator("query", listRunsQuerySchema),
		async (c: Context) => {
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
		},
	);

	app.get(
		"/runs/:runId",
		describeRoute({
			tags: ["apps"],
			description: "Get details of a specific GitHub App run",
			responses: {
				200: {
					description: "Details of a specific GitHub App run",
					content: { "application/json": {} },
				},
				401: {
					description: "Unauthorized",
					content: {
						"application/json": { schema: resolver(errorResponseSchema) },
					},
				},
			},
		}),
		zValidator("param", sandboxRunParamsSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
			const run = await getSandboxRunForUser({
				context: getServiceContext(c),
				userId: user.id,
				runId,
			});
			return ResponseFactory.success(c, { run });
		},
	);

	app.get(
		"/runs/:runId/events",
		zValidator("param", sandboxRunParamsSchema),
		zValidator("query", listRunEventsQuerySchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
			const query = c.req.valid("query" as never) as ListRunEventsQueryPayload;
			const events = await listSandboxRunEventsForUser({
				context: getServiceContext(c),
				userId: user.id,
				runId,
				after: query.after,
			});
			return ResponseFactory.success(c, { events });
		},
	);

	app.get(
		"/runs/:runId/events/stream",
		zValidator("param", sandboxRunParamsSchema),
		zValidator("query", listRunEventsQuerySchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
			const query = c.req.valid("query" as never) as ListRunEventsQueryPayload;

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
		},
	);

	app.get(
		"/runs/:runId/events/ws",
		zValidator("param", sandboxRunParamsSchema),
		async (c: Context) => {
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
			return stub.fetch("https://sandbox-run-coordinator/events/ws", c.req.raw);
		},
	);

	app.post(
		"/runs/:runId/pause",
		describeRoute({
			tags: ["apps"],
			description: "Pause a running sandbox run",
			responses: {
				200: {
					description: "Sandbox run pause was processed",
					content: { "application/json": {} },
				},
			},
		}),
		zValidator("param", sandboxRunParamsSchema),
		zValidator("json", pauseRunSchema),
		async (c: Context) => {
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
		},
	);

	app.post(
		"/runs/:runId/resume",
		describeRoute({
			tags: ["apps"],
			description: "Resume a paused sandbox run",
			responses: {
				200: {
					description: "Sandbox run resume was processed",
					content: { "application/json": {} },
				},
			},
		}),
		zValidator("param", sandboxRunParamsSchema),
		zValidator("json", resumeRunSchema),
		async (c: Context) => {
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
		},
	);

	app.post(
		"/runs/:runId/cancel",
		describeRoute({
			tags: ["apps"],
			description: "Cancel a running sandbox run",
			responses: {
				200: {
					description: "Sandbox run cancellation was processed",
					content: { "application/json": {} },
				},
			},
		}),
		zValidator("param", sandboxRunParamsSchema),
		zValidator("json", cancelRunSchema),
		async (c: Context) => {
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
		},
	);

	app.get(
		"/runs/:runId/control",
		describeRoute({
			tags: ["apps"],
			description: "Get run execution control state for worker coordination",
			responses: {
				200: {
					description: "Sandbox run control state",
					content: { "application/json": {} },
				},
			},
		}),
		zValidator("param", sandboxRunParamsSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
			const control = await getSandboxRunControlState({
				context: getServiceContext(c),
				userId: user.id,
				runId,
			});
			return ResponseFactory.success(c, control);
		},
	);
}

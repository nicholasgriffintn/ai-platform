import { type Context, type Hono } from "hono";
import { validator as zValidator, describeRoute, resolver } from "hono-openapi";
import {
	cancelRunSchema,
	errorResponseSchema,
	listRunsQuerySchema,
	pauseRunSchema,
	resumeRunSchema,
	type CancelRunPayload,
	type ListRunsQueryPayload,
	type PauseRunPayload,
	type ResumeRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getSandboxRunControlState,
	getSandboxRunForUser,
	listSandboxRunsForUser,
	requestSandboxRunCancellation,
	requestSandboxRunPause,
	requestSandboxRunResume,
} from "~/services/apps/sandbox/runs";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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
			const user = c.get("user") as IUser;
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
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
			const run = await getSandboxRunForUser({
				context: getServiceContext(c),
				userId: user.id,
				runId,
			});
			return ResponseFactory.success(c, { run });
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
		zValidator("json", pauseRunSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			const payload = c.req.valid("json" as never) as PauseRunPayload;
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
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
		zValidator("json", resumeRunSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			const payload = c.req.valid("json" as never) as ResumeRunPayload;
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
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
		zValidator("json", cancelRunSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			const payload = c.req.valid("json" as never) as CancelRunPayload;
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
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
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
			const control = await getSandboxRunControlState({
				context: getServiceContext(c),
				userId: user.id,
				runId,
			});
			return ResponseFactory.success(c, control);
		},
	);
}

import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	cancelDynamicWorkerRunSchema,
	dynamicWorkerRunParamsSchema,
	listDynamicWorkerRunEventsQuerySchema,
	listDynamicWorkerRunsQuerySchema,
	pauseDynamicWorkerRunSchema,
	resumeDynamicWorkerRunSchema,
	type CancelDynamicWorkerRunPayload,
	type DynamicWorkerRunParams,
	type ListDynamicWorkerRunEventsQuery,
	type ListDynamicWorkerRunsQuery,
	type PauseDynamicWorkerRunPayload,
	type ResumeDynamicWorkerRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuthenticatedUser } from "~/lib/http/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getDynamicWorkerRunForUser,
	listDynamicWorkerRunEventsForUser,
	listDynamicWorkerRunsForUser,
	requestDynamicWorkerRunCancellation,
	requestDynamicWorkerRunPause,
	requestDynamicWorkerRunResume,
} from "~/services/apps/dynamic-workers/runs";

function createEventsStream(events: unknown[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const event of events) {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			}
			controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			controller.close();
		},
	});
}

export function registerDynamicWorkerRunLifecycleRoutes(app: Hono): void {
	addRoute(app, "get", "/runs", {
		tags: ["apps"],
		description: "List user's dynamic worker runs",
		querySchema: listDynamicWorkerRunsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const payload = c.req.valid(
					"query" as never,
				) as ListDynamicWorkerRunsQuery;
				const serviceContext = getServiceContext(c);
				const runs = await listDynamicWorkerRunsForUser({
					context: serviceContext,
					userId: user.id,
					limit: payload.limit,
				});
				return ResponseFactory.success(c, { runs });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId", {
		tags: ["apps"],
		description: "Get details of a dynamic worker run",
		paramSchema: dynamicWorkerRunParamsSchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const run = await getDynamicWorkerRunForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
				});
				return ResponseFactory.success(c, { run });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/events", {
		tags: ["apps"],
		paramSchema: dynamicWorkerRunParamsSchema,
		querySchema: listDynamicWorkerRunEventsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const query = c.req.valid(
					"query" as never,
				) as ListDynamicWorkerRunEventsQuery;
				const events = await listDynamicWorkerRunEventsForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					after: query.after,
				});
				return ResponseFactory.success(c, { events });
			})(raw),
	});

	addRoute(app, "get", "/runs/:runId/events/stream", {
		tags: ["apps"],
		paramSchema: dynamicWorkerRunParamsSchema,
		querySchema: listDynamicWorkerRunEventsQuerySchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const query = c.req.valid(
					"query" as never,
				) as ListDynamicWorkerRunEventsQuery;
				const events = await listDynamicWorkerRunEventsForUser({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					after: query.after,
				});

				return new Response(
					createEventsStream(events.map((entry) => entry.event)),
					{
						headers: {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-cache, no-transform",
							Connection: "keep-alive",
						},
					},
				);
			})(raw),
	});

	addRoute(app, "post", "/runs/:runId/pause", {
		tags: ["apps"],
		description: "Pause a running dynamic worker run",
		bodySchema: pauseDynamicWorkerRunSchema,
		paramSchema: dynamicWorkerRunParamsSchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const payload = c.req.valid(
					"json" as never,
				) as PauseDynamicWorkerRunPayload;
				const result = await requestDynamicWorkerRunPause({
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
		description: "Resume a paused dynamic worker run",
		bodySchema: resumeDynamicWorkerRunSchema,
		paramSchema: dynamicWorkerRunParamsSchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const payload = c.req.valid(
					"json" as never,
				) as ResumeDynamicWorkerRunPayload;
				const result = await requestDynamicWorkerRunResume({
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
		description: "Cancel a running dynamic worker run",
		bodySchema: cancelDynamicWorkerRunSchema,
		paramSchema: dynamicWorkerRunParamsSchema,
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = requireAuthenticatedUser(c);
				const { runId } = c.req.valid(
					"param" as never,
				) as DynamicWorkerRunParams;
				const payload = c.req.valid(
					"json" as never,
				) as CancelDynamicWorkerRunPayload;
				const result = await requestDynamicWorkerRunCancellation({
					context: getServiceContext(c),
					userId: user.id,
					runId,
					reason: payload.reason,
				});
				return ResponseFactory.success(c, result);
			})(raw),
	});
}

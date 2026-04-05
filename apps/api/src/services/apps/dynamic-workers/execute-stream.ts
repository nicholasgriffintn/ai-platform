import type {
	DynamicWorkerRunEvent,
	DynamicWorkerRunStatus,
	ExecuteDynamicWorkerRunPayload,
} from "@assistant/schemas";
import { sandboxRunEventSchema } from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	DYNAMIC_WORKER_RUN_ITEM_TYPE,
	DYNAMIC_WORKER_RUNS_APP_ID,
	MAX_STORED_STREAM_EVENTS,
} from "~/constants/app";
import { SSE_HEADERS } from "~/lib/http/streaming";
import { executeDynamicRuntimeWorker } from "~/services/dynamic-runtime/worker";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { parseSseBuffer } from "~/utils/streaming";
import {
	registerDynamicWorkerRun,
	unregisterDynamicWorkerRun,
} from "./run-control";
import {
	appendDynamicWorkerRunEvent,
	type DynamicWorkerRunData,
} from "./run-data";

const logger = getLogger({
	prefix: "services/apps/dynamic-workers/execute-stream",
});

interface ExecuteDynamicWorkerRunStreamParams {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	payload: ExecuteDynamicWorkerRunPayload;
}

function toDynamicEvent(params: {
	runId: string;
	event: Record<string, unknown>;
}): DynamicWorkerRunEvent {
	const { runId, event } = params;
	return {
		type: typeof event.type === "string" ? event.type : "run_event",
		runId,
		runtimeBackend: "dynamic-worker",
		timestamp:
			typeof event.timestamp === "string"
				? event.timestamp
				: new Date().toISOString(),
		message: typeof event.message === "string" ? event.message : undefined,
		error: typeof event.error === "string" ? event.error : undefined,
		result:
			typeof event.result === "object" && event.result
				? (event.result as DynamicWorkerRunEvent["result"])
				: undefined,
	};
}

function updateStatusFromEvent(
	current: DynamicWorkerRunStatus,
	event: DynamicWorkerRunEvent,
): DynamicWorkerRunStatus {
	switch (event.type) {
		case "run_completed":
			return "completed";
		case "run_failed":
			return "failed";
		case "run_cancelled":
			return "cancelled";
		case "run_paused":
			return "paused";
		case "run_started":
		case "run_resumed":
			return "running";
		default:
			return current;
	}
}

export async function executeDynamicWorkerRunStream(
	params: ExecuteDynamicWorkerRunStreamParams,
): Promise<Response> {
	const { env, context: serviceContext, user, payload } = params;
	const runId = generateId();
	const now = new Date().toISOString();
	const timeoutSeconds = payload.timeoutSeconds;
	const timeoutAt =
		typeof timeoutSeconds === "number"
			? new Date(Date.now() + timeoutSeconds * 1000).toISOString()
			: undefined;

	let runData: DynamicWorkerRunData = {
		runId,
		runtimeBackend: "dynamic-worker",
		task: payload.task,
		code: payload.code,
		model: payload.model,
		trustLevel: payload.trustLevel,
		capabilities: payload.capabilities ?? [],
		status: "queued",
		startedAt: now,
		updatedAt: now,
		events: [],
		timeoutSeconds,
		timeoutAt,
	};

	const createdRecord =
		await serviceContext.repositories.appData.createAppDataWithItem(
			user.id,
			DYNAMIC_WORKER_RUNS_APP_ID,
			runId,
			DYNAMIC_WORKER_RUN_ITEM_TYPE,
			runData,
		);

	const abortController = new AbortController();
	registerDynamicWorkerRun(runId, abortController);

	const startedAt = new Date().toISOString();
	runData = {
		...runData,
		status: "running",
		updatedAt: startedAt,
	};
	await serviceContext.repositories.appData.updateAppData(
		createdRecord.id,
		runData,
	);

	let workerResponse: Response;
	try {
		workerResponse = await executeDynamicRuntimeWorker({
			env,
			context: serviceContext,
			user,
			runId,
			task: payload.task,
			code: payload.code,
			model: payload.model,
			trustLevel: payload.trustLevel,
			timeoutSeconds: payload.timeoutSeconds,
			capabilities: payload.capabilities,
			stream: true,
			signal: abortController.signal,
		});
	} catch (error) {
		unregisterDynamicWorkerRun(runId);
		const failedAt = new Date().toISOString();
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to start dynamic runtime worker";
		runData = {
			...runData,
			status: "failed",
			updatedAt: failedAt,
			completedAt: failedAt,
			error: errorMessage,
			events: appendDynamicWorkerRunEvent(
				runData.events,
				{
					type: "run_failed",
					runId,
					runtimeBackend: "dynamic-worker",
					error: errorMessage,
					timestamp: failedAt,
				},
				MAX_STORED_STREAM_EVENTS,
			),
		};
		await serviceContext.repositories.appData.updateAppData(
			createdRecord.id,
			runData,
		);
		return Response.json({ error: errorMessage }, { status: 500 });
	}

	if (!workerResponse.ok || !workerResponse.body) {
		unregisterDynamicWorkerRun(runId);
		const failedAt = new Date().toISOString();
		const responseError = workerResponse.body
			? (await workerResponse.text()).slice(0, 1000)
			: "Dynamic worker returned an empty response";
		runData = {
			...runData,
			status: "failed",
			updatedAt: failedAt,
			completedAt: failedAt,
			error: responseError,
			events: appendDynamicWorkerRunEvent(
				runData.events,
				{
					type: "run_failed",
					runId,
					runtimeBackend: "dynamic-worker",
					error: responseError,
					timestamp: failedAt,
				},
				MAX_STORED_STREAM_EVENTS,
			),
		};
		await serviceContext.repositories.appData.updateAppData(
			createdRecord.id,
			runData,
		);
		return Response.json({ error: responseError }, { status: 500 });
	}

	const reader = workerResponse.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let status: DynamicWorkerRunStatus = "running";
	let completedAt: string | undefined;
	let errorMessage: string | undefined;
	let result: DynamicWorkerRunData["result"];
	let events = runData.events ?? [];

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					if (!value) {
						continue;
					}

					controller.enqueue(value);
					buffer += decoder.decode(value, { stream: true });
					buffer = parseSseBuffer(buffer, {
						onEvent: (rawEvent) => {
							const parsed = sandboxRunEventSchema.safeParse(rawEvent);
							if (!parsed.success) {
								return;
							}
							const mapped = toDynamicEvent({ runId, event: parsed.data });
							events = appendDynamicWorkerRunEvent(
								events,
								mapped,
								MAX_STORED_STREAM_EVENTS,
							);
							status = updateStatusFromEvent(status, mapped);
							if (
								mapped.type === "run_completed" ||
								mapped.type === "run_failed" ||
								mapped.type === "run_cancelled"
							) {
								completedAt = new Date().toISOString();
							}
							if (mapped.type === "run_failed") {
								errorMessage = mapped.error || "Dynamic run failed";
							}
							if (mapped.type === "run_completed") {
								result = mapped.result;
							}
						},
						onError: (error) => {
							logger.error("Failed to parse dynamic worker event payload", {
								run_id: runId,
								error_message: error.message,
							});
						},
					});
				}
			} finally {
				reader.releaseLock();
				unregisterDynamicWorkerRun(runId);

				if (
					status !== "completed" &&
					status !== "failed" &&
					status !== "cancelled"
				) {
					status = abortController.signal.aborted ? "cancelled" : "failed";
					completedAt = new Date().toISOString();
					if (status === "failed") {
						errorMessage = "Dynamic run ended without a terminal event";
					}
				}

				runData = {
					...runData,
					status,
					result,
					error: status === "failed" ? errorMessage : undefined,
					events,
					updatedAt: new Date().toISOString(),
					completedAt,
					cancellationReason:
						status === "cancelled"
							? "Cancelled by user request"
							: runData.cancellationReason,
				};

				await serviceContext.repositories.appData.updateAppData(
					createdRecord.id,
					runData,
				);
				controller.close();
			}
		},
		cancel() {
			abortController.abort("Client disconnected");
		},
	});

	return new Response(stream, {
		headers: {
			...SSE_HEADERS,
			"X-Dynamic-Worker-Run-Id": runId,
		},
	});
}

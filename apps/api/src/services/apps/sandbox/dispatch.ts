import {
	sandboxRunEventSchema,
	type ExecuteSandboxRunPayload,
	type SandboxRunData,
	type SandboxRunEvent,
	type SandboxRunStatus,
} from "@assistant/schemas";

import {
	MAX_STORED_STREAM_EVENTS,
	SANDBOX_RUN_ITEM_TYPE,
	SANDBOX_RUNS_APP_ID,
} from "~/constants/app";
import { createServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";
import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { parseSseBuffer } from "~/utils/streaming";
import {
	appendSandboxRunEvent,
	parseSandboxRunData,
	type SandboxRunData as PersistedSandboxRunData,
} from "./run-data";
import { persistSandboxRunArtifact } from "./run-artifacts";
import {
	appendRunCoordinatorEvent,
	updateRunCoordinatorControl,
} from "./run-coordinator";
import { indexSandboxRunResult } from "./run-indexing";

const logger = getLogger({ prefix: "services/apps/sandbox/dispatch" });

const RUN_DISPATCH_KIND = "sandbox_run_dispatch" as const;

type RunDispatchPayload = Pick<
	ExecuteSandboxRunPayload,
	| "installationId"
	| "repo"
	| "task"
	| "model"
	| "promptStrategy"
	| "shouldCommit"
	| "timeoutSeconds"
	| "trustLevel"
>;

export interface SandboxRunDispatchMessage {
	kind: typeof RUN_DISPATCH_KIND;
	runId: string;
	recordId: string;
	userId: number;
	payload: RunDispatchPayload;
}

function isTerminalStatus(status: SandboxRunStatus): boolean {
	return (
		status === "completed" || status === "failed" || status === "cancelled"
	);
}

function toCoordinatorState(
	status: SandboxRunStatus,
): "queued" | "running" | "paused" | "cancelled" {
	if (status === "queued") {
		return "queued";
	}
	if (status === "running") {
		return "running";
	}
	if (status === "paused") {
		return "paused";
	}
	return "cancelled";
}

export function isSandboxRunDispatchMessage(
	message: unknown,
): message is SandboxRunDispatchMessage {
	if (!message || typeof message !== "object") {
		return false;
	}
	const value = message as Record<string, unknown>;
	return (
		value.kind === RUN_DISPATCH_KIND &&
		typeof value.runId === "string" &&
		typeof value.recordId === "string" &&
		typeof value.userId === "number" &&
		value.payload !== null &&
		typeof value.payload === "object"
	);
}

export async function enqueueSandboxRunDispatch(params: {
	env: IEnv;
	message: SandboxRunDispatchMessage;
}): Promise<void> {
	const { env, message } = params;
	if (!env.TASK_QUEUE) {
		throw new Error(
			"TASK_QUEUE binding is not configured for sandbox run dispatch",
		);
	}
	await env.TASK_QUEUE.send(message);
}

async function loadRunData(params: {
	env: IEnv;
	recordId: string;
}): Promise<PersistedSandboxRunData | null> {
	const context = createServiceContext({
		env: params.env,
	});
	const record = await context.repositories.appData.getAppDataById(
		params.recordId,
	);
	if (!record?.data) {
		return null;
	}
	return parseSandboxRunData(
		typeof record.data === "string" ? safeParseJson(record.data) : record.data,
	);
}

async function persistRunData(params: {
	env: IEnv;
	recordId: string;
	runData: PersistedSandboxRunData;
}): Promise<PersistedSandboxRunData> {
	const context = createServiceContext({
		env: params.env,
	});
	let runData = params.runData;
	runData = await persistSandboxRunArtifact({
		serviceContext: context,
		run: runData,
	});
	await context.repositories.appData.updateAppData(params.recordId, runData);
	return runData;
}

export async function processSandboxRunDispatch(params: {
	env: IEnv;
	message: SandboxRunDispatchMessage;
}): Promise<void> {
	const { env, message } = params;
	const context = createServiceContext({ env });
	const user = await context.repositories.users.getUserById(message.userId);
	if (!user) {
		logger.error("Skipping sandbox run dispatch: user not found", {
			run_id: message.runId,
			user_id: message.userId,
		});
		return;
	}

	let runData =
		(await loadRunData({
			env,
			recordId: message.recordId,
		})) ?? null;
	if (!runData) {
		logger.error("Skipping sandbox run dispatch: run record not found", {
			run_id: message.runId,
			record_id: message.recordId,
		});
		return;
	}
	if (isTerminalStatus(runData.status)) {
		return;
	}

	const startedAt = new Date().toISOString();
	runData = {
		...runData,
		status: "running",
		updatedAt: startedAt,
		processingStartedAt: startedAt,
		workflowPhase: "executing",
	};
	await context.repositories.appData.updateAppData(message.recordId, runData);
	await updateRunCoordinatorControl({
		env,
		runId: message.runId,
		state: "running",
		updatedAt: startedAt,
		timeoutSeconds: runData.timeoutSeconds,
		timeoutAt: runData.timeoutAt,
	});

	let workerResponse: Response;
	try {
		workerResponse = await executeSandboxWorker({
			env,
			context,
			user,
			repo: message.payload.repo,
			task: message.payload.task,
			model: message.payload.model,
			promptStrategy: message.payload.promptStrategy,
			shouldCommit: message.payload.shouldCommit,
			timeoutSeconds: message.payload.timeoutSeconds,
			trustLevel: message.payload.trustLevel,
			installationId: message.payload.installationId,
			stream: true,
			runId: message.runId,
		});
	} catch (error) {
		const completedAt = new Date().toISOString();
		const errorMessage =
			error instanceof Error ? error.message : "Failed to start sandbox worker";
		const nextRun: PersistedSandboxRunData = {
			...runData,
			status: "failed",
			updatedAt: completedAt,
			completedAt,
			error: errorMessage,
			events: appendSandboxRunEvent(
				runData.events,
				{
					type: "run_failed",
					runId: message.runId,
					error: errorMessage,
					timestamp: completedAt,
				},
				MAX_STORED_STREAM_EVENTS,
			),
			workflowPhase: "failed",
		};
		await appendRunCoordinatorEvent({
			env,
			runId: message.runId,
			event: {
				type: "run_failed",
				runId: message.runId,
				error: errorMessage,
				timestamp: completedAt,
			},
		});
		await updateRunCoordinatorControl({
			env,
			runId: message.runId,
			state: "cancelled",
			updatedAt: completedAt,
			cancellationReason: errorMessage,
			timeoutSeconds: runData.timeoutSeconds,
			timeoutAt: runData.timeoutAt,
		});
		await persistRunData({
			env,
			recordId: message.recordId,
			runData: nextRun,
		});
		return;
	}

	let status: SandboxRunStatus = "running";
	let completedAt: string | undefined;
	let errorMessage: string | undefined;
	let cancellationReason: string | undefined;
	let result: SandboxRunData["result"];
	let events = runData.events ?? [];
	let pausedAt: string | undefined;
	let resumedAt: string | undefined;
	let pauseReason: string | undefined;
	let resumeReason: string | undefined;
	let promptStrategy = runData.promptStrategy;
	const coordinatorWritePromises: Promise<void>[] = [];

	const appendEvent = (event: SandboxRunEvent) => {
		events = appendSandboxRunEvent(events, event, MAX_STORED_STREAM_EVENTS);
		coordinatorWritePromises.push(
			appendRunCoordinatorEvent({
				env,
				runId: message.runId,
				event,
			}),
		);
	};

	if (!workerResponse.ok) {
		const failedAt = new Date().toISOString();
		const responseError = (await workerResponse.text()).slice(0, 1000);
		appendEvent({
			type: "run_failed",
			runId: message.runId,
			error: responseError || "Sandbox worker returned an error response",
			timestamp: failedAt,
		});
		status = "failed";
		completedAt = failedAt;
		errorMessage = responseError || "Sandbox worker returned an error response";
	} else if (!workerResponse.body) {
		const failedAt = new Date().toISOString();
		appendEvent({
			type: "run_failed",
			runId: message.runId,
			error: "Sandbox worker returned an empty response",
			timestamp: failedAt,
		});
		status = "failed";
		completedAt = failedAt;
		errorMessage = "Sandbox worker returned an empty response";
	} else {
		const contentType = workerResponse.headers.get("content-type") || "";
		if (!contentType.includes("text/event-stream")) {
			const payload = (await workerResponse.json()) as Record<string, unknown>;
			const now = new Date().toISOString();
			status = payload.success ? "completed" : "failed";
			completedAt = now;
			errorMessage =
				typeof payload.error === "string" ? payload.error : undefined;
			result = payload;
			appendEvent({
				type: status === "completed" ? "run_completed" : "run_failed",
				runId: message.runId,
				result,
				error: errorMessage,
				timestamp: now,
			});
		} else {
			const reader = workerResponse.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					if (!value) {
						continue;
					}
					buffer += decoder.decode(value, { stream: true });
					buffer = parseSseBuffer(buffer, {
						onEvent: (rawEvent) => {
							const parsed = sandboxRunEventSchema.safeParse(rawEvent);
							if (!parsed.success) {
								return;
							}
							const event = parsed.data;
							void appendEvent(event);

							if (event.promptStrategy) {
								promptStrategy = event.promptStrategy;
							}
							if (event.type === "run_completed") {
								status = "completed";
								completedAt = new Date().toISOString();
								result = event.result;
								errorMessage = undefined;
								return;
							}
							if (event.type === "run_failed") {
								status = "failed";
								completedAt = new Date().toISOString();
								errorMessage =
									typeof event.error === "string"
										? event.error
										: "Sandbox run failed";
								return;
							}
							if (event.type === "run_cancelled") {
								status = "cancelled";
								completedAt = new Date().toISOString();
								cancellationReason =
									typeof event.message === "string"
										? event.message
										: typeof event.error === "string"
											? event.error
											: "Run cancelled by user";
								errorMessage = undefined;
								return;
							}
							if (event.type === "run_paused") {
								status = "paused";
								pausedAt = new Date().toISOString();
								pauseReason =
									typeof event.message === "string"
										? event.message
										: pauseReason;
								return;
							}
							if (event.type === "run_resumed") {
								status = "running";
								resumedAt = new Date().toISOString();
								resumeReason =
									typeof event.message === "string"
										? event.message
										: resumeReason;
							}
						},
						onError: (error) => {
							logger.error("Failed to parse sandbox event payload", {
								run_id: message.runId,
								error_message: error.message,
							});
						},
					});
				}
			} finally {
				reader.releaseLock();
			}
		}
	}

	if (!isTerminalStatus(status)) {
		status = "failed";
		completedAt = new Date().toISOString();
		errorMessage = "Sandbox run ended without a terminal event";
		appendEvent({
			type: "run_failed",
			runId: message.runId,
			error: errorMessage,
			timestamp: completedAt,
		});
	}
	await Promise.allSettled(coordinatorWritePromises);

	const resolvedStatus = status as SandboxRunStatus;
	const finalUpdatedAt = new Date().toISOString();
	const nextRunData: PersistedSandboxRunData = {
		...runData,
		status: resolvedStatus,
		result,
		error: resolvedStatus === "failed" ? errorMessage : undefined,
		events,
		promptStrategy,
		updatedAt: finalUpdatedAt,
		completedAt,
		pausedAt,
		resumedAt,
		pauseReason,
		resumeReason,
		cancelRequestedAt:
			resolvedStatus === "cancelled"
				? (runData.cancelRequestedAt ?? completedAt)
				: runData.cancelRequestedAt,
		cancellationReason:
			resolvedStatus === "cancelled"
				? cancellationReason
				: runData.cancellationReason,
		workflowPhase:
			resolvedStatus === "completed"
				? "completed"
				: resolvedStatus === "failed"
					? "failed"
					: resolvedStatus === "cancelled"
						? "cancelled"
						: "finalizing",
	};
	const persisted = await persistRunData({
		env,
		recordId: message.recordId,
		runData: nextRunData,
	});
	await indexSandboxRunResult({
		serviceContext: context,
		userId: message.userId,
		run: persisted,
	});
	await updateRunCoordinatorControl({
		env,
		runId: message.runId,
		state: toCoordinatorState(persisted.status),
		updatedAt: persisted.updatedAt,
		cancellationReason:
			persisted.status === "cancelled" || persisted.status === "failed"
				? persisted.error || persisted.cancellationReason
				: undefined,
		timeoutSeconds: persisted.timeoutSeconds,
		timeoutAt: persisted.timeoutAt,
	});
}

export async function buildSandboxRunDispatchMessage(params: {
	recordId: string;
	runId: string;
	userId: number;
	payload: RunDispatchPayload;
}): Promise<SandboxRunDispatchMessage> {
	return {
		kind: RUN_DISPATCH_KIND,
		recordId: params.recordId,
		runId: params.runId,
		userId: params.userId,
		payload: params.payload,
	};
}

export async function getSandboxRunRecordForDispatch(params: {
	env: IEnv;
	runId: string;
	userId: number;
}): Promise<{ id: string; run: PersistedSandboxRunData } | null> {
	const context = createServiceContext({ env: params.env });
	const records = await context.repositories.appData.getAppDataByUserAppAndItem(
		params.userId,
		SANDBOX_RUNS_APP_ID,
		params.runId,
		SANDBOX_RUN_ITEM_TYPE,
	);
	if (!records.length) {
		return null;
	}
	const parsed = parseSandboxRunData(safeParseJson(records[0].data));
	if (!parsed) {
		return null;
	}
	return {
		id: records[0].id,
		run: parsed,
	};
}

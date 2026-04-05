import type {
	DynamicWorkerRunData,
	DynamicWorkerRunEvent,
	DynamicWorkerRunStatus,
} from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	DYNAMIC_WORKER_RUN_ITEM_TYPE,
	DYNAMIC_WORKER_RUNS_APP_ID,
	MAX_STORED_STREAM_EVENTS,
} from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { cancelDynamicWorkerRun } from "./run-control";
import {
	appendDynamicWorkerRunEvent,
	parseDynamicWorkerRunData,
	toDynamicWorkerRunResponse,
} from "./run-data";

interface DynamicWorkerRunRecord {
	recordId: string;
	run: DynamicWorkerRunData;
}

function isTerminalStatus(status: DynamicWorkerRunStatus): boolean {
	return (
		status === "completed" || status === "failed" || status === "cancelled"
	);
}

function parseDynamicWorkerRunRecordData(
	value: string,
): DynamicWorkerRunData | null {
	return parseDynamicWorkerRunData(safeParseJson(value));
}

async function getDynamicWorkerRunRecordForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}): Promise<DynamicWorkerRunRecord> {
	const { context, userId, runId } = params;
	const records = await context.repositories.appData.getAppDataByUserAppAndItem(
		userId,
		DYNAMIC_WORKER_RUNS_APP_ID,
		runId,
		DYNAMIC_WORKER_RUN_ITEM_TYPE,
	);

	if (!records.length) {
		throw new AssistantError(
			"Dynamic worker run not found",
			ErrorType.NOT_FOUND,
		);
	}

	const parsed = parseDynamicWorkerRunRecordData(records[0].data);
	if (!parsed) {
		throw new AssistantError(
			"Dynamic worker run payload is invalid",
			ErrorType.NOT_FOUND,
		);
	}

	return {
		recordId: records[0].id,
		run: parsed,
	};
}

export async function listDynamicWorkerRunsForUser(params: {
	context: ServiceContext;
	userId: number;
	limit: number;
}) {
	const { context, userId, limit } = params;
	const records = await context.repositories.appData.getAppDataByUserAndApp(
		userId,
		DYNAMIC_WORKER_RUNS_APP_ID,
	);

	return records
		.map((record) => parseDynamicWorkerRunRecordData(record.data))
		.filter((run): run is DynamicWorkerRunData => Boolean(run))
		.map((run) => toDynamicWorkerRunResponse(run))
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)
		.slice(0, limit);
}

export async function getDynamicWorkerRunForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}) {
	const runRecord = await getDynamicWorkerRunRecordForUser(params);
	return toDynamicWorkerRunResponse(runRecord.run);
}

export async function listDynamicWorkerRunEventsForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	after?: number;
}): Promise<
	Array<{ index: number; recordedAt: string; event: DynamicWorkerRunEvent }>
> {
	const { context, userId, runId, after } = params;
	const runRecord = await getDynamicWorkerRunRecordForUser({
		context,
		userId,
		runId,
	});
	const events = runRecord.run.events ?? [];
	const startIndex = typeof after === "number" && after > 0 ? after : 0;

	return events.slice(startIndex).map((event, idx) => ({
		index: startIndex + idx + 1,
		recordedAt: event.timestamp ?? runRecord.run.updatedAt,
		event,
	}));
}

export async function requestDynamicWorkerRunCancellation(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getDynamicWorkerRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (isTerminalStatus(run.status)) {
		return {
			cancelled: run.status === "cancelled",
			message: `Run already ${run.status}`,
			run: toDynamicWorkerRunResponse(run),
		};
	}

	const now = new Date().toISOString();
	const cancellationReason = reason?.trim() || "Cancelled by user request";
	const nextRun: DynamicWorkerRunData = {
		...run,
		status: "cancelled",
		updatedAt: now,
		completedAt: now,
		cancelRequestedAt: now,
		cancellationReason,
		error: undefined,
		events: appendDynamicWorkerRunEvent(
			run.events,
			{
				type: "run_cancelled",
				runId: run.runId,
				runtimeBackend: "dynamic-worker",
				message: cancellationReason,
				timestamp: now,
			},
			MAX_STORED_STREAM_EVENTS,
		),
	};

	await context.repositories.appData.updateAppData(runRecord.recordId, nextRun);

	return {
		cancelled: true,
		aborted: cancelDynamicWorkerRun(runId),
		message: "Cancellation requested",
		run: toDynamicWorkerRunResponse(nextRun),
	};
}

export async function requestDynamicWorkerRunPause(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getDynamicWorkerRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (isTerminalStatus(run.status)) {
		return {
			paused: false,
			message: `Run already ${run.status}`,
			run: toDynamicWorkerRunResponse(run),
		};
	}

	const now = new Date().toISOString();
	const pauseReason = reason?.trim() || "Paused by user request";
	const nextRun: DynamicWorkerRunData = {
		...run,
		status: "paused",
		updatedAt: now,
		pausedAt: now,
		pauseReason,
		events: appendDynamicWorkerRunEvent(
			run.events,
			{
				type: "run_paused",
				runId: run.runId,
				runtimeBackend: "dynamic-worker",
				message: pauseReason,
				timestamp: now,
			},
			MAX_STORED_STREAM_EVENTS,
		),
	};

	await context.repositories.appData.updateAppData(runRecord.recordId, nextRun);

	return {
		paused: true,
		message: "Pause requested",
		run: toDynamicWorkerRunResponse(nextRun),
	};
}

export async function requestDynamicWorkerRunResume(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getDynamicWorkerRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (isTerminalStatus(run.status)) {
		return {
			resumed: false,
			message: `Run already ${run.status}`,
			run: toDynamicWorkerRunResponse(run),
		};
	}

	if (run.status !== "paused") {
		return {
			resumed: false,
			message: "Run is not paused",
			run: toDynamicWorkerRunResponse(run),
		};
	}

	const now = new Date().toISOString();
	const resumeReason = reason?.trim() || "Resumed by user request";
	const nextRun: DynamicWorkerRunData = {
		...run,
		status: "running",
		updatedAt: now,
		resumedAt: now,
		resumeReason,
		events: appendDynamicWorkerRunEvent(
			run.events,
			{
				type: "run_resumed",
				runId: run.runId,
				runtimeBackend: "dynamic-worker",
				message: resumeReason,
				timestamp: now,
			},
			MAX_STORED_STREAM_EVENTS,
		),
	};

	await context.repositories.appData.updateAppData(runRecord.recordId, nextRun);

	return {
		resumed: true,
		message: "Run resumed",
		run: toDynamicWorkerRunResponse(nextRun),
	};
}

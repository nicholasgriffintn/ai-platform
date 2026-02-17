import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	MAX_STORED_STREAM_EVENTS,
	SANDBOX_RUN_ITEM_TYPE,
	SANDBOX_RUNS_APP_ID,
} from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import {
	appendSandboxRunEvent,
	parseSandboxRunData,
	toSandboxRunResponse,
	type SandboxRunData,
} from "./run-data";
import { cancelActiveSandboxRun } from "./run-control";

type SandboxRunControlState = "running" | "paused" | "cancelled";

interface SandboxRunRecord {
	recordId: string;
	run: SandboxRunData;
}

interface PersistRunStateTransitionParams {
	context: ServiceContext;
	runRecord: SandboxRunRecord;
	nextRun: SandboxRunData;
}

function toRunControlState(run: SandboxRunData): SandboxRunControlState {
	switch (run.status) {
		case "paused":
			return "paused";
		case "cancelled":
		case "completed":
		case "failed":
			return "cancelled";
		default:
			return "running";
	}
}

function isTerminalRunStatus(status: SandboxRunData["status"]): boolean {
	return (
		status === "completed" || status === "failed" || status === "cancelled"
	);
}

async function persistRunStateTransition(
	params: PersistRunStateTransitionParams,
): Promise<SandboxRunData> {
	const { context, runRecord, nextRun } = params;
	await context.repositories.appData.updateAppData(runRecord.recordId, nextRun);
	return nextRun;
}
function parseSandboxRunRecordData(value: string): SandboxRunData | null {
	return parseSandboxRunData(safeParseJson(value));
}

async function getSandboxRunRecordForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}): Promise<SandboxRunRecord> {
	const { context, userId, runId } = params;
	const records = await context.repositories.appData.getAppDataByUserAppAndItem(
		userId,
		SANDBOX_RUNS_APP_ID,
		runId,
		SANDBOX_RUN_ITEM_TYPE,
	);

	if (!records.length) {
		throw new AssistantError("Sandbox run not found", ErrorType.NOT_FOUND);
	}

	const parsed = parseSandboxRunRecordData(records[0].data);
	if (!parsed) {
		throw new AssistantError(
			"Sandbox run payload is invalid",
			ErrorType.NOT_FOUND,
		);
	}

	return {
		recordId: records[0].id,
		run: parsed,
	};
}

export async function listSandboxRunsForUser(params: {
	context: ServiceContext;
	userId: number;
	installationId?: number;
	repo?: string;
	limit: number;
}) {
	const { context, userId, installationId, repo, limit } = params;
	const records = await context.repositories.appData.getAppDataByUserAndApp(
		userId,
		SANDBOX_RUNS_APP_ID,
	);

	return records
		.map((record) => parseSandboxRunRecordData(record.data))
		.filter((run): run is SandboxRunData => Boolean(run))
		.filter((run) => {
			if (
				installationId !== undefined &&
				run.installationId !== installationId
			) {
				return false;
			}

			if (repo && run.repo.toLowerCase() !== repo.toLowerCase()) {
				return false;
			}

			return true;
		})
		.map((run) => toSandboxRunResponse(run))
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)
		.slice(0, limit);
}

export async function getSandboxRunForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}) {
	const runRecord = await getSandboxRunRecordForUser(params);
	return toSandboxRunResponse(runRecord.run);
}

export async function requestSandboxRunCancellation(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getSandboxRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (run.status === "completed" || run.status === "failed") {
		return {
			cancelled: false,
			aborted: false,
			message: `Run already ${run.status}`,
			run: toSandboxRunResponse(run),
		};
	}

	if (run.status === "cancelled") {
		return {
			cancelled: true,
			aborted: false,
			message: "Run is already cancelled",
			run: toSandboxRunResponse(run),
		};
	}

	const cancelledAt = new Date().toISOString();
	const cancellationReason = reason?.trim() || "Cancelled by user request";
	const nextRun: SandboxRunData = {
		...run,
		status: "cancelled",
		updatedAt: cancelledAt,
		completedAt: cancelledAt,
		cancelRequestedAt: cancelledAt,
		cancellationReason,
		error: undefined,
		events: appendSandboxRunEvent(
			run.events,
			{
				type: "run_cancelled",
				runId: run.runId,
				message: cancellationReason,
				timestamp: cancelledAt,
			},
			MAX_STORED_STREAM_EVENTS,
		),
	};

	await persistRunStateTransition({
		context,
		runRecord,
		nextRun,
	});

	return {
		cancelled: true,
		aborted: cancelActiveSandboxRun(runId),
		message: "Cancellation requested",
		run: toSandboxRunResponse(nextRun),
	};
}

export async function requestSandboxRunPause(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getSandboxRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (isTerminalRunStatus(run.status)) {
		return {
			paused: false,
			message: `Run already ${run.status}`,
			run: toSandboxRunResponse(run),
		};
	}

	if (run.status === "paused") {
		return {
			paused: true,
			message: "Run is already paused",
			run: toSandboxRunResponse(run),
		};
	}

	const pausedAt = new Date().toISOString();
	const pauseReason = reason?.trim() || "Paused by user request";
	const nextRun: SandboxRunData = {
		...run,
		status: "paused",
		updatedAt: pausedAt,
		pausedAt,
		pauseReason,
	};

	await persistRunStateTransition({
		context,
		runRecord,
		nextRun,
	});

	return {
		paused: true,
		message: "Pause requested",
		run: toSandboxRunResponse(nextRun),
	};
}

export async function requestSandboxRunResume(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	reason?: string;
}) {
	const { context, userId, runId, reason } = params;
	const runRecord = await getSandboxRunRecordForUser({
		context,
		userId,
		runId,
	});
	const run = runRecord.run;

	if (isTerminalRunStatus(run.status)) {
		return {
			resumed: false,
			message: `Run already ${run.status}`,
			run: toSandboxRunResponse(run),
		};
	}

	if (run.status !== "paused") {
		return {
			resumed: false,
			message: "Run is not paused",
			run: toSandboxRunResponse(run),
		};
	}

	const resumedAt = new Date().toISOString();
	const resumeReason = reason?.trim() || "Resumed by user request";
	const nextRun: SandboxRunData = {
		...run,
		status: "running",
		updatedAt: resumedAt,
		resumedAt,
		resumeReason,
	};

	await persistRunStateTransition({
		context,
		runRecord,
		nextRun,
	});

	return {
		resumed: true,
		message: "Run resumed",
		run: toSandboxRunResponse(nextRun),
	};
}

export async function getSandboxRunControlState(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}) {
	const runRecord = await getSandboxRunRecordForUser(params);
	const run = runRecord.run;

	return {
		runId: run.runId,
		state: toRunControlState(run),
		updatedAt: run.updatedAt,
		cancellationReason: run.cancellationReason,
		pauseReason: run.pauseReason,
		timeoutSeconds: run.timeoutSeconds,
		timeoutAt: run.timeoutAt,
	};
}

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

interface SandboxRunRecord {
	recordId: string;
	run: SandboxRunData;
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

	await context.repositories.appData.updateAppData(runRecord.recordId, nextRun);

	return {
		cancelled: true,
		aborted: cancelActiveSandboxRun(runId),
		message: "Cancellation requested",
		run: toSandboxRunResponse(nextRun),
	};
}

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SandboxRunInstruction } from "@assistant/schemas";
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
	type SandboxRunStatus,
} from "./run-data";
import { cancelActiveSandboxRun } from "./run-control";
import {
	appendRunCoordinatorEvent,
	getRunCoordinatorControl,
	listRunCoordinatorEvents,
	listRunCoordinatorInstructions,
	submitRunCoordinatorInstruction,
	updateRunCoordinatorControl,
} from "./run-coordinator";

type SandboxRunControlState = "queued" | "running" | "paused" | "cancelled";

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
		case "queued":
			return "queued";
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

function applyEventStatus(
	run: SandboxRunData,
	eventType: string,
): SandboxRunStatus {
	switch (eventType) {
		case "run_completed":
			return "completed";
		case "run_failed":
			return "failed";
		case "run_cancelled":
			return "cancelled";
		case "run_paused":
			return "paused";
		case "run_resumed":
		case "run_started":
			return "running";
		default:
			return run.status;
	}
}

async function mergeCoordinatorEventsIfNewer(params: {
	context: ServiceContext;
	run: SandboxRunData;
}): Promise<{ run: SandboxRunData; merged: boolean }> {
	const { context, run } = params;
	const coordinatorEvents = await listRunCoordinatorEvents({
		env: context.env,
		runId: run.runId,
		after: 0,
	});
	if (!coordinatorEvents.length) {
		return { run, merged: false };
	}

	const events = coordinatorEvents.map((entry) => entry.event);
	const existingCount = run.events?.length ?? 0;
	if (events.length <= existingCount) {
		return { run, merged: false };
	}

	const terminalEvent = [...events]
		.reverse()
		.find(
			(event) =>
				event.type === "run_completed" ||
				event.type === "run_failed" ||
				event.type === "run_cancelled",
		);
	const latestEventWithTimestamp = [...events]
		.reverse()
		.find((event) => typeof event.timestamp === "string");
	const derivedStatus = applyEventStatus(
		run,
		events[events.length - 1]?.type ?? "",
	);
	const completedAt =
		terminalEvent?.completedAt ?? terminalEvent?.timestamp ?? run.completedAt;

	return {
		run: {
			...run,
			events,
			status: derivedStatus,
			updatedAt: latestEventWithTimestamp?.timestamp ?? run.updatedAt,
			completedAt:
				derivedStatus === "completed" ||
				derivedStatus === "failed" ||
				derivedStatus === "cancelled"
					? completedAt
					: run.completedAt,
			error:
				derivedStatus === "failed"
					? (terminalEvent?.error ?? run.error)
					: undefined,
			result:
				derivedStatus === "completed" || derivedStatus === "failed"
					? (terminalEvent?.result ?? run.result)
					: run.result,
			cancellationReason:
				derivedStatus === "cancelled"
					? (terminalEvent?.message ??
						terminalEvent?.error ??
						run.cancellationReason)
					: run.cancellationReason,
		},
		merged: true,
	};
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

export async function listSandboxRunEventsForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	after?: number;
}) {
	const { context, userId, runId, after } = params;
	await getSandboxRunRecordForUser({ context, userId, runId });
	return listRunCoordinatorEvents({
		env: context.env,
		runId,
		after,
	});
}

export async function listSandboxRunInstructionsForUser(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	after?: number;
}) {
	const { context, userId, runId, after } = params;
	await getSandboxRunRecordForUser({ context, userId, runId });
	return listRunCoordinatorInstructions({
		env: context.env,
		runId,
		after,
	});
}

export async function requestSandboxRunInstruction(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
	kind: "message" | "continue" | "approval_request" | "approval_response";
	content?: string;
	command?: string;
	requestId?: string;
	approvalStatus?: "approved" | "rejected";
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction> {
	const {
		context,
		userId,
		runId,
		kind,
		content,
		command,
		requestId,
		approvalStatus,
		timeoutSeconds,
		escalateAfterSeconds,
	} = params;
	const runRecord = await getSandboxRunRecordForUser({
		context,
		userId,
		runId,
	});
	if (isTerminalRunStatus(runRecord.run.status)) {
		throw new AssistantError(
			`Cannot send instructions to a ${runRecord.run.status} run`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const instruction = await submitRunCoordinatorInstruction({
		env: context.env,
		runId,
		kind,
		content,
		command,
		requestId,
		approvalStatus,
		timeoutSeconds,
		escalateAfterSeconds,
	});
	if (!instruction) {
		throw new AssistantError(
			"Failed to submit run instruction",
			ErrorType.UNKNOWN_ERROR,
		);
	}

	await appendRunCoordinatorEvent({
		env: context.env,
		runId,
		event: {
			type: "run_instruction_submitted",
			runId,
			timestamp: instruction.createdAt,
			instructionId: instruction.id,
			instructionKind: instruction.kind,
			message:
				instruction.kind === "continue"
					? "Continue instruction submitted"
					: instruction.kind === "approval_request"
						? "Command approval requested via instruction"
						: instruction.kind === "approval_response"
							? "Command approval response submitted"
							: "Operator message submitted",
			instructionContent:
				typeof instruction.content === "string" &&
				instruction.content.trim().length > 0
					? instruction.content.slice(0, 500)
					: undefined,
			command: instruction.command,
			approvalStatus: instruction.approvalStatus,
			approvalId: instruction.requestId ?? instruction.id,
		},
	});

	return instruction;
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
	const merged = await mergeCoordinatorEventsIfNewer({
		context: params.context,
		run: runRecord.run,
	});
	if (merged.merged) {
		await params.context.repositories.appData.updateAppData(
			runRecord.recordId,
			merged.run,
		);
	}
	return toSandboxRunResponse(merged.run);
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
	await updateRunCoordinatorControl({
		env: context.env,
		runId,
		state: "cancelled",
		updatedAt: cancelledAt,
		cancellationReason,
		timeoutSeconds: nextRun.timeoutSeconds,
		timeoutAt: nextRun.timeoutAt,
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
	await updateRunCoordinatorControl({
		env: context.env,
		runId,
		state: "paused",
		updatedAt: pausedAt,
		pauseReason,
		timeoutSeconds: nextRun.timeoutSeconds,
		timeoutAt: nextRun.timeoutAt,
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
	await updateRunCoordinatorControl({
		env: context.env,
		runId,
		state: "running",
		updatedAt: resumedAt,
		pauseReason: undefined,
		timeoutSeconds: nextRun.timeoutSeconds,
		timeoutAt: nextRun.timeoutAt,
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
	const coordinator = await getRunCoordinatorControl(
		params.context.env,
		params.runId,
	);
	if (coordinator) {
		return coordinator;
	}

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

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SandboxRunInstruction } from "@assistant/schemas";
import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { parseSandboxRunData, type SandboxRunData } from "./run-data";
import {
	appendRunCoordinatorEvent,
	getRunCoordinatorControl,
	listRunCoordinatorInstructions,
	submitRunCoordinatorInstruction,
} from "./run-coordinator";

type SandboxRunControlState = "queued" | "running" | "paused" | "cancelled";

interface SandboxRunRecord {
	run: SandboxRunData;
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
	return status === "completed" || status === "failed" || status === "cancelled";
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
		throw new AssistantError("Sandbox run payload is invalid", ErrorType.NOT_FOUND);
	}

	return {
		run: parsed,
	};
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
		throw new AssistantError("Failed to submit run instruction", ErrorType.UNKNOWN_ERROR);
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
				typeof instruction.content === "string" && instruction.content.trim().length > 0
					? instruction.content.slice(0, 500)
					: undefined,
			command: instruction.command,
			approvalStatus: instruction.approvalStatus,
			approvalId: instruction.requestId ?? instruction.id,
		},
	});

	return instruction;
}

export async function getSandboxRunControlState(params: {
	context: ServiceContext;
	userId: number;
	runId: string;
}) {
	const coordinator = await getRunCoordinatorControl(params.context.env, params.runId);
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

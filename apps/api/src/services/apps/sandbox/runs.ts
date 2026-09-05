import type {
  SandboxRunControl,
  SandboxRunInstruction,
  SandboxRunInstructionKind,
  SandboxServiceAction,
  UpdateSandboxRunControl,
} from "@ngriffin_uk/polychat-schemas";
import { SANDBOX_RUNS_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { notifyMobileProjectRun } from "~/services/mobile-push";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

import {
  appendRunCoordinatorEvent,
  getRunCoordinatorControl,
  listRunCoordinatorEvents,
  listRunCoordinatorInstructions,
  submitRunCoordinatorInstruction,
  updateRunCoordinatorControl,
} from "./run-coordinator";
import { parseSandboxRunData, type SandboxRunData } from "./run-data";

type SandboxRunControlState = "queued" | "running" | "paused" | "cancelled";

interface SandboxRunRecord {
  id: string;
  createdByUserId: number;
  projectId: string | null;
  conversationId: string | null;
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
    case "running":
      return "running";
  }

  return "running";
}

function isTerminalRunStatus(status: SandboxRunData["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function parseSandboxRunRecordData(value: string): SandboxRunData | null {
  return parseSandboxRunData(safeParseJson(value));
}

export async function getSandboxRunRecordForUser(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
}): Promise<SandboxRunRecord> {
  const { context, userId, runId } = params;
  const record = await context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_CAPABILITY_ID,
    runId,
  );

  if (!record) {
    throw new AssistantError("Sandbox run not found", ErrorType.NOT_FOUND);
  }

  if (record.project_id) {
    await requireProjectAccess(context, record.project_id);
  } else if (record.created_by_user_id !== userId) {
    throw new AssistantError("Sandbox run not found", ErrorType.NOT_FOUND);
  }

  const parsed = parseSandboxRunRecordData(record.data);

  if (!parsed) {
    throw new AssistantError("Sandbox run payload is invalid", ErrorType.NOT_FOUND);
  }

  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    conversationId: record.conversation_id,
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

export async function requestSandboxRunInstruction(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
  kind: SandboxRunInstructionKind;
  idempotencyKey?: string;
  content?: string;
  command?: string;
  requestId?: string;
  approvalStatus?: "approved" | "rejected";
  serviceName?: string;
  serviceAction?: SandboxServiceAction;
  timeoutSeconds?: number;
  escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction> {
  const {
    context,
    userId,
    runId,
    kind,
    idempotencyKey,
    content,
    command,
    requestId,
    approvalStatus,
    serviceName,
    serviceAction,
    timeoutSeconds,
    escalateAfterSeconds,
  } = params;
  const runRecord = await getSandboxRunRecordForUser({
    context,
    userId,
    runId,
  });

  if (runRecord.createdByUserId !== userId) {
    throw new AssistantError(
      "Only the run owner can steer this coding run",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (isTerminalRunStatus(runRecord.run.status)) {
    throw new AssistantError(
      `Cannot send instructions to a ${runRecord.run.status} run`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const submission = await submitRunCoordinatorInstruction({
    env: context.env,
    runId,
    kind,
    idempotencyKey,
    content,
    command,
    requestId,
    approvalStatus,
    serviceName,
    serviceAction,
    timeoutSeconds,
    escalateAfterSeconds,
    createdByUserId: userId,
  });

  if (!submission) {
    throw new AssistantError("Failed to submit run instruction", ErrorType.UNKNOWN_ERROR);
  }

  if (submission.ok === false) {
    const errorType =
      submission.status === 409
        ? ErrorType.CONFLICT_ERROR
        : submission.status === 404
          ? ErrorType.NOT_FOUND
          : submission.status >= 400 && submission.status < 500
            ? ErrorType.PARAMS_ERROR
            : ErrorType.UNKNOWN_ERROR;

    throw new AssistantError(submission.error, errorType, submission.status);
  }

  const { instruction } = submission;

  if (!submission.replayed) {
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
                : instruction.kind === "service_action"
                  ? `${instruction.serviceAction ?? "Service"} requested for ${instruction.serviceName ?? "service"}`
                  : "Operator message submitted",
        instructionContent:
          typeof instruction.content === "string" && instruction.content.trim().length > 0
            ? instruction.content.slice(0, 500)
            : undefined,
        createdByUserId: userId,
        command: instruction.command,
        approvalStatus: instruction.approvalStatus,
        approvalId: instruction.requestId ?? instruction.id,
        serviceName: instruction.serviceName,
        serviceAction: instruction.serviceAction,
      },
    });

    if (instruction.kind === "approval_request") {
      await context.repositories.activities.updateActivity(runRecord.id, { status: "waiting" });
      await notifyMobileProjectRun({
        context,
        userId: runRecord.createdByUserId,
        notificationId: `sandbox:${runId}:approval:${instruction.id}`,
        kind: "approval",
        projectId: runRecord.projectId,
        conversationId: runRecord.conversationId,
        runId,
        interactionId: instruction.requestId ?? instruction.id,
      });
    } else if (instruction.kind === "approval_response") {
      await context.repositories.activities.updateActivity(runRecord.id, {
        status: runRecord.run.status === "paused" ? "waiting" : "running",
      });
    }
  }

  return instruction;
}

function runControlFromRecord(run: SandboxRunData): SandboxRunControl {
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

export async function requestSandboxRunControlAction(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
  input: UpdateSandboxRunControl;
}): Promise<SandboxRunControl> {
  const { context, userId, runId, input } = params;
  const runRecord = await getSandboxRunRecordForUser({ context, userId, runId });

  if (runRecord.createdByUserId !== userId) {
    throw new AssistantError(
      "Only the run owner can control this coding run",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (runRecord.run.status === "completed" || runRecord.run.status === "failed") {
    throw new AssistantError(
      `Cannot ${input.action} a ${runRecord.run.status} run`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const current =
    (await getRunCoordinatorControl(context.env, runId)) ?? runControlFromRecord(runRecord.run);
  const desiredState =
    input.action === "pause" ? "paused" : input.action === "resume" ? "running" : "cancelled";

  if (current.state === desiredState) {
    return current;
  }

  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
    throw new AssistantError(
      "The run changed before this action was applied. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const actionAllowed =
    (input.action === "pause" && current.state === "running") ||
    (input.action === "resume" && current.state === "paused") ||
    (input.action === "cancel" &&
      (current.state === "queued" || current.state === "running" || current.state === "paused"));

  if (!actionAllowed) {
    throw new AssistantError(
      `Cannot ${input.action} a ${current.state} run`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const now = new Date().toISOString();
  const updated = await updateRunCoordinatorControl({
    env: context.env,
    runId,
    state: desiredState,
    updatedAt: now,
    expectedUpdatedAt: current.updatedAt,
    pauseReason: input.action === "pause" ? (input.reason ?? "Paused by run owner") : undefined,
    cancellationReason:
      input.action === "cancel" ? (input.reason ?? "Cancelled by run owner") : undefined,
  });

  if (!updated) {
    const latest = await getRunCoordinatorControl(context.env, runId);

    if (latest?.state === desiredState) {
      return latest;
    }

    throw new AssistantError(
      "The run changed before this action was applied. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await appendRunCoordinatorEvent({
    env: context.env,
    runId,
    event: {
      type: `run_${input.action}_requested`,
      runId,
      timestamp: now,
      message: input.reason,
    },
  });

  return updated;
}

export async function getSandboxRunControlState(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
}) {
  const runRecord = await getSandboxRunRecordForUser(params);
  const coordinator = await getRunCoordinatorControl(params.context.env, params.runId);

  if (coordinator) {
    return coordinator;
  }

  const run = runRecord.run;

  return runControlFromRecord(run);
}

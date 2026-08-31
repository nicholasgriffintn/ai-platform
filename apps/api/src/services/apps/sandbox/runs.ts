import type { SandboxRunInstruction } from "@ngriffin_uk/polychat-schemas";

import { MAX_STORED_STREAM_EVENTS, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

import {
  appendRunCoordinatorEvent,
  getRunCoordinatorControl,
  listRunCoordinatorInstructions,
  submitRunCoordinatorInstruction,
  updateRunCoordinatorControl,
} from "./run-coordinator";
import {
  appendSandboxRunEvent,
  getSandboxActivityStatus,
  parseSandboxRunData,
  type SandboxRunData,
} from "./run-data";

type SandboxRunControlState = "queued" | "running" | "paused" | "cancelled";

interface SandboxRunRecord {
  run: SandboxRunData;
  createdByUserId: number;
}

function toRunControlState(run: SandboxRunData): SandboxRunControlState {
  switch (run.status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
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

export async function getSandboxRunRecordForUser(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
}): Promise<SandboxRunRecord> {
  const { context, userId, runId } = params;
  const record = await context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_APP_ID,
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
    run: parsed,
    createdByUserId: record.created_by_user_id,
  };
}

export async function requireSandboxRunWriteAuthority(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
}): Promise<SandboxRunRecord> {
  const record = await getSandboxRunRecordForUser(params);
  const authorityUserId =
    record.run.projectTaskContext?.runnerIdentityUserId ?? record.createdByUserId;

  if (params.userId !== authorityUserId) {
    throw new AssistantError(
      "Only the run identity can change sandbox execution state",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return record;
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

  const approvalAuthorityUserId =
    runRecord.run.projectTaskContext?.runnerIdentityUserId ?? runRecord.createdByUserId;

  if (kind === "approval_response" && userId !== approvalAuthorityUserId) {
    throw new AssistantError(
      "Only the run identity can approve credential-bearing sandbox work",
      ErrorType.FORBIDDEN,
      403,
    );
  }

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
  const runRecord = await getSandboxRunRecordForUser(params);
  const run = runRecord.run;

  if (isTerminalRunStatus(run.status)) {
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

  const coordinator = await getRunCoordinatorControl(params.context.env, params.runId);

  if (coordinator) {
    return coordinator;
  }

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

export async function cancelSandboxRunForProjectTask(params: {
  context: ServiceContext;
  taskId: string;
  projectId: string;
  sandboxRunId: string;
  runnerIdentityUserId: number;
  reason: string;
}): Promise<void> {
  const { context, sandboxRunId } = params;
  const record = await context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_APP_ID,
    sandboxRunId,
  );
  const run = record ? parseSandboxRunRecordData(record.data) : null;

  if (
    !record ||
    !run ||
    record.project_id !== params.projectId ||
    record.created_by_user_id !== params.runnerIdentityUserId ||
    run.runId !== sandboxRunId ||
    run.projectTaskContext?.taskId !== params.taskId ||
    run.projectTaskContext.projectId !== params.projectId ||
    run.projectTaskContext.runnerIdentityUserId !== params.runnerIdentityUserId
  ) {
    return;
  }

  if (isTerminalRunStatus(run.status)) {
    return;
  }

  const cancelledAt = new Date().toISOString();
  const event = {
    type: "run_cancelled" as const,
    runId: sandboxRunId,
    timestamp: cancelledAt,
    message: params.reason,
    projectTaskContext: run.projectTaskContext,
  };
  const cancelled: SandboxRunData = {
    ...run,
    status: "cancelled",
    updatedAt: cancelledAt,
    completedAt: cancelledAt,
    cancelRequestedAt: cancelledAt,
    cancellationReason: params.reason,
    workflowPhase: "cancelled",
    events: appendSandboxRunEvent(run.events, event, MAX_STORED_STREAM_EVENTS),
  };

  const cancelledRecord = await context.repositories.activities.compareAndSetActivity(
    record.id,
    ["queued", "running", "waiting"],
    {
      status: getSandboxActivityStatus(cancelled.status),
      data: cancelled,
    },
  );

  if (!cancelledRecord) {
    return;
  }

  await Promise.all([
    appendRunCoordinatorEvent({ env: context.env, runId: sandboxRunId, event }),
    updateRunCoordinatorControl({
      env: context.env,
      runId: sandboxRunId,
      state: "cancelled",
      updatedAt: cancelledAt,
      cancellationReason: params.reason,
      timeoutSeconds: run.timeoutSeconds,
      timeoutAt: run.timeoutAt,
    }),
  ]);
}

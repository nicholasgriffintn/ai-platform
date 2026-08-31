import type {
  ExecuteSandboxRunPayload,
  SandboxRunData,
  SandboxRunDispatchMessage,
} from "@ngriffin_uk/polychat-schemas";
import { executeSandboxRunSchema } from "@ngriffin_uk/polychat-schemas";

import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ActivityRecord } from "~/repositories/ActivityRepository";
import { resolveSandboxModel } from "~/services/sandbox/worker";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { buildSandboxTimeoutConfig } from "./config";
import { buildSandboxRunDispatchMessage, enqueueSandboxRunDispatchTask } from "./dispatch";
import {
  appendRunCoordinatorEvent,
  initRunCoordinatorControl,
  updateRunCoordinatorControl,
} from "./run-coordinator";
import { getSandboxActivityStatus, parseSandboxRunData } from "./run-data";
import { assertSandboxRunCanStart } from "./run-limits";

const logger = getLogger({ prefix: "services/apps/sandbox/create-run" });

export interface PreparedSandboxRun {
  record: ActivityRecord;
  run: SandboxRunData;
  message: SandboxRunDispatchMessage;
}

function parseExactPersistedRun(params: {
  record: ActivityRecord;
  expectedRun: SandboxRunData;
  userId: number;
  projectId?: string;
  conversationId?: string;
}): SandboxRunData {
  const { record, expectedRun, userId, projectId, conversationId } = params;
  const persistedRun = parseSandboxRunData(
    typeof record.data === "string" ? safeParseJson(record.data) : record.data,
  );

  if (
    !persistedRun ||
    record.group_id !== expectedRun.runId ||
    record.created_by_user_id !== userId ||
    record.project_id !== (projectId ?? null) ||
    record.conversation_id !== (conversationId ?? null) ||
    record.capability_id !== SANDBOX_RUNS_APP_ID ||
    record.kind !== SANDBOX_RUN_ITEM_TYPE ||
    persistedRun.runId !== expectedRun.runId ||
    persistedRun.installationId !== expectedRun.installationId ||
    persistedRun.repo !== expectedRun.repo ||
    persistedRun.task !== expectedRun.task ||
    persistedRun.taskType !== expectedRun.taskType ||
    persistedRun.model !== expectedRun.model ||
    persistedRun.promptStrategy !== expectedRun.promptStrategy ||
    persistedRun.shouldCommit !== expectedRun.shouldCommit ||
    persistedRun.trustLevel !== expectedRun.trustLevel ||
    persistedRun.tokenBudget !== expectedRun.tokenBudget ||
    JSON.stringify(persistedRun.leanProof) !== JSON.stringify(expectedRun.leanProof) ||
    JSON.stringify(persistedRun.projectTaskContext) !==
      JSON.stringify(expectedRun.projectTaskContext)
  ) {
    throw new Error("The persisted sandbox preparation does not match this exact run");
  }

  return persistedRun;
}

interface PrepareSandboxRunParams {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  payload: ExecuteSandboxRunPayload;
  projectId?: string;
  conversationId?: string;
  runId?: string;
  activityId?: string;
}

function buildFailedSandboxRun(run: SandboxRunData, error: unknown): SandboxRunData {
  const failedAt = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : "Failed to queue sandbox run";

  return {
    ...run,
    status: "failed",
    updatedAt: failedAt,
    completedAt: failedAt,
    error: errorMessage,
    events: [
      {
        type: "run_failed",
        runId: run.runId,
        error: errorMessage,
        timestamp: failedAt,
        projectTaskContext: run.projectTaskContext,
      },
    ],
    workflowPhase: "failed",
  };
}

async function compensateFailedPreparation(params: {
  env: IEnv;
  context: ServiceContext;
  record: ActivityRecord;
  run: SandboxRunData;
  error: unknown;
}): Promise<void> {
  const { env, context, record, run, error } = params;
  const failedRun = buildFailedSandboxRun(run, error);

  try {
    await context.repositories.activities.compareAndSetActivity(record.id, ["queued"], {
      status: getSandboxActivityStatus(failedRun.status),
      data: failedRun,
    });
  } catch (cleanupError) {
    logger.error("Could not mark partially prepared sandbox run as failed", {
      run_id: run.runId,
      error_message:
        cleanupError instanceof Error ? cleanupError.message : "Unknown activity cleanup error",
    });
  }

  try {
    await updateRunCoordinatorControl({
      env,
      runId: run.runId,
      state: "cancelled",
      updatedAt: failedRun.updatedAt,
      cancellationReason: failedRun.error,
      timeoutSeconds: run.timeoutSeconds,
      timeoutAt: run.timeoutAt,
    });
  } catch (cleanupError) {
    logger.error("Could not cancel partially initialised sandbox run coordinator", {
      run_id: run.runId,
      error_message:
        cleanupError instanceof Error ? cleanupError.message : "Unknown coordinator cleanup error",
    });
  }
}

export async function prepareSandboxRun(
  params: PrepareSandboxRunParams,
): Promise<PreparedSandboxRun> {
  const { env, context, user, projectId, conversationId } = params;
  const payload = executeSandboxRunSchema.parse(params.payload);

  const model = await resolveSandboxModel({
    context,
    userId: user.id,
    model: payload.model,
  });
  const timeoutConfig = buildSandboxTimeoutConfig({
    env,
    requestedTimeoutSeconds: payload.timeoutSeconds,
  });
  const runId = params.runId ?? generateId();
  const now = new Date().toISOString();
  const run: SandboxRunData = {
    runId,
    installationId: payload.installationId,
    repo: payload.repo,
    task: payload.task,
    taskType: payload.taskType,
    model,
    trustLevel: payload.trustLevel ?? "balanced",
    promptStrategy: payload.promptStrategy,
    shouldCommit: payload.shouldCommit ?? false,
    status: "queued",
    startedAt: now,
    updatedAt: now,
    events: [],
    timeoutSeconds: timeoutConfig.timeoutSeconds,
    timeoutAt: timeoutConfig.timeoutAt,
    workflowPhase: "queued",
    leanProof: payload.leanProof,
    tokenBudget: payload.tokenBudget,
    projectTaskContext: payload.projectTaskContext,
  };
  let record = params.activityId
    ? await context.repositories.activities.getActivityById(params.activityId)
    : null;

  if (!record) {
    await assertSandboxRunCanStart({ context, userId: user.id });
    record = await context.repositories.activities.createActivity({
      id: params.activityId,
      createdByUserId: user.id,
      projectId,
      conversationId,
      capabilityId: SANDBOX_RUNS_APP_ID,
      groupId: runId,
      kind: SANDBOX_RUN_ITEM_TYPE,
      status: getSandboxActivityStatus(run.status),
      summary: `${payload.repo}: ${payload.task}`,
      data: run,
    });
  }

  const persistedRun = parseExactPersistedRun({
    record,
    expectedRun: run,
    userId: user.id,
    projectId,
    conversationId,
  });

  try {
    await initRunCoordinatorControl(env, {
      runId,
      state: "queued",
      updatedAt: persistedRun.updatedAt,
      timeoutSeconds: persistedRun.timeoutSeconds,
      timeoutAt: persistedRun.timeoutAt,
    });
    await appendRunCoordinatorEvent({
      env,
      runId,
      event: {
        type: "run_queued",
        runId,
        repo: payload.repo,
        installationId: payload.installationId,
        timestamp: persistedRun.updatedAt,
        timeoutSeconds: persistedRun.timeoutSeconds,
        timeoutAt: persistedRun.timeoutAt,
        message: "Run queued for sandbox dispatch",
        projectTaskContext: payload.projectTaskContext,
      },
    });
  } catch (error) {
    await compensateFailedPreparation({ env, context, record, run, error });
    throw error;
  }

  return {
    record,
    run: persistedRun,
    message: buildSandboxRunDispatchMessage({
      recordId: record.id,
      runId,
      userId: user.id,
      payload: {
        installationId: payload.installationId,
        repo: payload.repo,
        task: payload.task,
        taskType: payload.taskType,
        model: persistedRun.model,
        promptStrategy: persistedRun.promptStrategy,
        shouldCommit: persistedRun.shouldCommit,
        timeoutSeconds: persistedRun.timeoutSeconds,
        trustLevel: persistedRun.trustLevel ?? "balanced",
        modelSettings: payload.modelSettings,
        leanProof: persistedRun.leanProof,
        tokenBudget: persistedRun.tokenBudget,
        projectTaskContext: persistedRun.projectTaskContext,
      },
    }),
  };
}

export async function failPreparedSandboxRun(params: {
  env: IEnv;
  context: ServiceContext;
  prepared: PreparedSandboxRun;
  error: unknown;
}): Promise<void> {
  const { env, context, prepared } = params;
  const failedRun = buildFailedSandboxRun(prepared.run, params.error);
  const failedAt = failedRun.updatedAt;
  const errorMessage = failedRun.error ?? "Failed to queue sandbox run";

  const failedRecord = await context.repositories.activities.compareAndSetActivity(
    prepared.record.id,
    ["queued", "running", "waiting"],
    {
      status: getSandboxActivityStatus(failedRun.status),
      data: failedRun,
    },
  );

  if (!failedRecord) {
    return;
  }

  await appendRunCoordinatorEvent({
    env,
    runId: prepared.run.runId,
    event: {
      type: "run_failed",
      runId: prepared.run.runId,
      error: errorMessage,
      timestamp: failedAt,
      projectTaskContext: prepared.run.projectTaskContext,
    },
  });
  await updateRunCoordinatorControl({
    env,
    runId: prepared.run.runId,
    state: "cancelled",
    updatedAt: failedAt,
    cancellationReason: errorMessage,
    timeoutSeconds: prepared.run.timeoutSeconds,
    timeoutAt: prepared.run.timeoutAt,
  });
  logger.error("Failed to queue sandbox run", {
    run_id: prepared.run.runId,
    error_message: errorMessage,
  });
}

export async function enqueuePreparedSandboxRun(params: {
  env: IEnv;
  context: ServiceContext;
  prepared: PreparedSandboxRun;
  projectId?: string;
}): Promise<SandboxRunData> {
  const { env, context, prepared, projectId } = params;

  try {
    await enqueueSandboxRunDispatchTask({
      context,
      message: prepared.message,
      projectId,
    });
    const dispatchedAt = new Date().toISOString();

    await appendRunCoordinatorEvent({
      env,
      runId: prepared.run.runId,
      event: {
        type: "run_dispatched",
        runId: prepared.run.runId,
        timestamp: dispatchedAt,
        message: "Run dispatch enqueued via shared task system",
        projectTaskContext: prepared.run.projectTaskContext,
      },
    });
    const queuedRun: SandboxRunData = {
      ...prepared.run,
      queueDispatchedAt: dispatchedAt,
      updatedAt: dispatchedAt,
      workflowPhase: "dispatching",
    };

    const queuedRecord = await context.repositories.activities.compareAndSetActivity(
      prepared.record.id,
      ["queued"],
      {
        status: getSandboxActivityStatus(queuedRun.status),
        data: queuedRun,
      },
    );

    if (!queuedRecord) {
      const current = await context.repositories.activities.getActivityById(prepared.record.id);
      const currentRun = current?.data
        ? parseSandboxRunData(
            typeof current.data === "string" ? safeParseJson(current.data) : current.data,
          )
        : null;

      return currentRun ?? queuedRun;
    }

    return queuedRun;
  } catch (error) {
    await failPreparedSandboxRun({ env, context, prepared, error });
    throw error;
  }
}

export async function enqueueSandboxRun(
  params: PrepareSandboxRunParams,
): Promise<PreparedSandboxRun> {
  const prepared = await prepareSandboxRun(params);

  await enqueuePreparedSandboxRun({
    env: params.env,
    context: params.context,
    prepared,
    projectId: params.projectId,
  });

  return prepared;
}

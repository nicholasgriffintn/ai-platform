import {
  SANDBOX_RUN_DISPATCH_TASK_TYPE,
  sandboxRunDispatchMessageSchema,
  sandboxRunEventSchema,
  type SandboxRunDispatchMessage,
  type SandboxRunData,
  type SandboxRunEvent,
  type SandboxRunStatus,
} from "@ngriffin_uk/polychat-schemas";

import { MAX_STORED_STREAM_EVENTS, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { GoalService } from "~/services/goals/GoalService";
import { executeSandboxWorker } from "~/services/sandbox/worker";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv, IUser } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { parseSseBuffer } from "~/utils/streaming";

import { persistSandboxRunArtifact } from "./run-artifacts";
import { appendRunCoordinatorEvent, updateRunCoordinatorControl } from "./run-coordinator";
import {
  appendSandboxRunEvent,
  getSandboxActivityStatus,
  parseSandboxRunData,
  type SandboxRunData as PersistedSandboxRunData,
} from "./run-data";
import { indexSandboxRunResult } from "./run-indexing";

const logger = getLogger({ prefix: "services/apps/sandbox/dispatch" });

function isTerminalStatus(status: SandboxRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
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
  return sandboxRunDispatchMessageSchema.safeParse(message).success;
}

export async function enqueueSandboxRunDispatchTask(params: {
  context: ServiceContext;
  message: SandboxRunDispatchMessage;
  projectId?: string;
}): Promise<string> {
  const { context, message, projectId } = params;

  if (!context.env.TASK_QUEUE) {
    throw new Error("TASK_QUEUE binding is not configured for sandbox run dispatch");
  }

  const taskService = new TaskService(context.env, context.repositories.tasks);

  return taskService.enqueueTask({
    task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
    user_id: message.userId,
    project_id: projectId,
    task_data: message,
    priority: 8,
    metadata: {
      runId: message.runId,
      recordId: message.recordId,
      repo: message.payload.repo,
    },
  });
}

async function loadRunData(params: {
  env: IEnv;
  recordId: string;
}): Promise<PersistedSandboxRunData | null> {
  const context = createServiceContext({
    env: params.env,
  });
  const record = await context.repositories.activities.getActivityById(params.recordId);

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
  userId: number;
  runData: PersistedSandboxRunData;
}): Promise<PersistedSandboxRunData> {
  const context = createServiceContext({
    env: params.env,
  });
  const record = await context.repositories.activities.getActivityById(params.recordId);
  let runData = params.runData;

  runData = await persistSandboxRunArtifact({
    serviceContext: context,
    ownerUserId: params.userId,
    projectId: record?.project_id,
    conversationId: record?.conversation_id,
    run: runData,
  });
  await context.repositories.activities.updateActivity(params.recordId, {
    status: getSandboxActivityStatus(runData.status),
    data: runData,
  });

  return runData;
}

async function ensureRunGoal(params: {
  context: ServiceContext;
  runId: string;
  user: IUser;
  objective: string;
}): Promise<void> {
  if (params.user.plan_id !== "pro" || !params.objective?.trim()) {
    return;
  }

  try {
    const service = new GoalService(params.context.repositories.goals);

    await service.setGoal({
      owner: { sandboxRunId: params.runId },
      user: params.user,
      objective: params.objective.trim(),
      source: "user",
    });
  } catch (error) {
    logger.error("Failed to create the run goal", { error, run_id: params.runId });
  }
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

  // A run is a thread in its own right, so it owns its goal: the task it was
  // dispatched with becomes the objective its finish gate audits against.
  await ensureRunGoal({
    context,
    runId: message.runId,
    user,
    objective: message.payload.task,
  });

  const startedAt = new Date().toISOString();

  runData = {
    ...runData,
    status: "running",
    updatedAt: startedAt,
    processingStartedAt: startedAt,
    workflowPhase: "executing",
  };
  await context.repositories.activities.updateActivity(message.recordId, {
    status: getSandboxActivityStatus(runData.status),
    data: runData,
  });
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
      taskType: message.payload.taskType,
      model: message.payload.model,
      promptStrategy: message.payload.promptStrategy,
      shouldCommit: message.payload.shouldCommit,
      timeoutSeconds: message.payload.timeoutSeconds,
      trustLevel: message.payload.trustLevel,
      modelSettings: message.payload.modelSettings,
      installationId: message.payload.installationId,
      stream: true,
      runId: message.runId,
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Failed to start sandbox worker";
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
      userId: message.userId,
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
      errorMessage = typeof payload.error === "string" ? payload.error : undefined;
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

              appendEvent(event);

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
                errorMessage = typeof event.error === "string" ? event.error : "Sandbox run failed";

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
                pauseReason = typeof event.message === "string" ? event.message : pauseReason;

                return;
              }

              if (event.type === "run_resumed") {
                status = "running";
                resumedAt = new Date().toISOString();
                resumeReason = typeof event.message === "string" ? event.message : resumeReason;
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
      resolvedStatus === "cancelled" ? cancellationReason : runData.cancellationReason,
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
    userId: message.userId,
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

export function buildSandboxRunDispatchMessage(params: {
  recordId: string;
  runId: string;
  userId: number;
  payload: SandboxRunDispatchMessage["payload"];
}): SandboxRunDispatchMessage {
  return {
    kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
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
  const record = await context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_APP_ID,
    params.runId,
  );

  if (!record || record.created_by_user_id !== params.userId) {
    return null;
  }

  const parsed = parseSandboxRunData(safeParseJson(record.data));

  if (!parsed) {
    return null;
  }

  return {
    id: record.id,
    run: parsed,
  };
}

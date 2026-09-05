import {
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  type ExecuteSandboxRunPayload as ExecuteSandboxRunStreamPayload,
  SANDBOX_RUNS_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";

import { SANDBOX_RUN_ITEM_TYPE } from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { SSE_HEADERS } from "~/lib/http/streaming";
import { resolveSandboxModel } from "~/services/sandbox/worker";
import { resolveProjectEnvironmentCacheForRun } from "~/services/workspaces/environment-cache";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { buildSandboxTimeoutConfig } from "./config";
import { buildSandboxRunDispatchMessage, enqueueSandboxRunDispatchTask } from "./dispatch";
import {
  appendRunCoordinatorEvent,
  initRunCoordinatorControl,
  listRunCoordinatorEvents,
  openRunCoordinatorEventsSocket,
  updateRunCoordinatorControl,
} from "./run-coordinator";
import { getSandboxActivityStatus, type SandboxRunData } from "./run-data";
import { assertSandboxRunCanStart } from "./run-limits";
import { createCoordinatorEventSseStream } from "./streaming";

const logger = getLogger({ prefix: "services/apps/sandbox/execute-stream" });

interface ExecuteSandboxRunStreamParams {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  payload: ExecuteSandboxRunStreamPayload;
  projectId?: string;
  conversationId?: string;
}

export async function executeSandboxRunStream(
  params: ExecuteSandboxRunStreamParams,
): Promise<Response> {
  const { env, context: serviceContext, user, payload, projectId, conversationId } = params;

  await assertSandboxRunCanStart({
    context: serviceContext,
    userId: user.id,
  });

  const model = await resolveSandboxModel({
    context: serviceContext,
    user,
    model: payload.model,
  });
  const timeoutConfig = buildSandboxTimeoutConfig({
    env,
    requestedTimeoutSeconds: payload.timeoutSeconds,
  });
  const deliveryPolicy = resolveSandboxDeliveryPolicy(payload.deliveryPolicy, payload.shouldCommit);
  const projectEnvironment = projectId
    ? await resolveProjectEnvironmentCacheForRun({
        context: serviceContext,
        projectId,
        repository: payload.repo,
        installationId: payload.installationId,
      })
    : {
        environmentSetup: payload.environmentSetup,
        environmentCache: undefined,
        environmentCacheGeneration: 0,
      };

  const runId = generateId();
  const now = new Date().toISOString();
  const runData: SandboxRunData = {
    runId,
    projectId,
    installationId: payload.installationId,
    repo: payload.repo,
    task: payload.task,
    taskType: payload.taskType,
    model,
    trustLevel: payload.trustLevel ?? "balanced",
    promptStrategy: payload.promptStrategy,
    deliveryPolicy,
    shouldCommit: sandboxDeliveryPolicyCreatesCommit(deliveryPolicy),
    environmentSetup: projectEnvironment.environmentSetup,
    environmentPreparationMode: "setup",
    environmentCacheGeneration: projectEnvironment.environmentCacheGeneration,
    status: "queued",
    startedAt: now,
    updatedAt: now,
    events: [],
    timeoutSeconds: timeoutConfig.timeoutSeconds,
    timeoutAt: timeoutConfig.timeoutAt,
    workflowPhase: "queued",
  };

  const createdRecord = await serviceContext.repositories.activities.createActivity({
    createdByUserId: user.id,
    projectId,
    conversationId,
    capabilityId: SANDBOX_RUNS_CAPABILITY_ID,
    groupId: runId,
    kind: SANDBOX_RUN_ITEM_TYPE,
    status: getSandboxActivityStatus(runData.status),
    summary: `${payload.repo}: ${payload.task}`,
    data: runData,
  });

  await initRunCoordinatorControl(env, {
    runId,
    state: "queued",
    updatedAt: runData.updatedAt,
    timeoutSeconds: runData.timeoutSeconds,
    timeoutAt: runData.timeoutAt,
  });
  await appendRunCoordinatorEvent({
    env,
    runId,
    event: {
      type: "run_queued",
      runId,
      repo: payload.repo,
      installationId: payload.installationId,
      timestamp: now,
      timeoutSeconds: timeoutConfig.timeoutSeconds,
      timeoutAt: timeoutConfig.timeoutAt,
      message: "Run queued for sandbox dispatch",
    },
  });

  try {
    const dispatchMessage = buildSandboxRunDispatchMessage({
      recordId: createdRecord.id,
      runId,
      userId: user.id,
      payload: {
        projectId,
        installationId: payload.installationId,
        repo: payload.repo,
        task: payload.task,
        taskType: payload.taskType,
        model,
        promptStrategy: payload.promptStrategy,
        deliveryPolicy,
        environmentSetup: projectEnvironment.environmentSetup,
        environmentPreparationMode: "setup",
        environmentCache: projectEnvironment.environmentCache,
        environmentCacheGeneration: projectEnvironment.environmentCacheGeneration,
        timeoutSeconds: timeoutConfig.timeoutSeconds,
        trustLevel: payload.trustLevel ?? "balanced",
        modelSettings: payload.modelSettings,
      },
    });

    await enqueueSandboxRunDispatchTask({
      context: serviceContext,
      message: dispatchMessage,
      projectId,
    });
    const dispatchedAt = new Date().toISOString();

    await appendRunCoordinatorEvent({
      env,
      runId,
      event: {
        type: "run_dispatched",
        runId,
        timestamp: dispatchedAt,
        message: "Run dispatch enqueued via shared task system",
      },
    });
    const queuedRun: SandboxRunData = {
      ...runData,
      queueDispatchedAt: dispatchedAt,
      updatedAt: dispatchedAt,
      workflowPhase: "dispatching",
    };

    await serviceContext.repositories.activities.updateActivity(createdRecord.id, {
      status: getSandboxActivityStatus(queuedRun.status),
      data: queuedRun,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Failed to queue sandbox run";
    const failedRun: SandboxRunData = {
      ...runData,
      status: "failed",
      updatedAt: failedAt,
      completedAt: failedAt,
      error: errorMessage,
      events: [
        {
          type: "run_failed",
          runId,
          error: errorMessage,
          timestamp: failedAt,
        },
      ],
      workflowPhase: "failed",
    };

    await serviceContext.repositories.activities.updateActivity(createdRecord.id, {
      status: getSandboxActivityStatus(failedRun.status),
      data: failedRun,
    });
    await appendRunCoordinatorEvent({
      env,
      runId,
      event: {
        type: "run_failed",
        runId,
        error: errorMessage,
        timestamp: failedAt,
      },
    });
    await updateRunCoordinatorControl({
      env,
      runId,
      state: "cancelled",
      updatedAt: failedAt,
      cancellationReason: errorMessage,
      timeoutSeconds: runData.timeoutSeconds,
      timeoutAt: runData.timeoutAt,
    });
    logger.error("Failed to queue sandbox run", {
      run_id: runId,
      error_message: errorMessage,
    });

    return Response.json({ error: errorMessage }, { status: 500 });
  }

  const stream = createCoordinatorEventSseStream({
    openSocket: () =>
      openRunCoordinatorEventsSocket({
        env,
        runId,
      }),
    listEvents: (after) =>
      listRunCoordinatorEvents({
        env,
        runId,
        after,
      }),
  });

  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
      "X-Sandbox-Run-Id": runId,
    },
  });
}

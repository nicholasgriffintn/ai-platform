import {
  containerSecondQuantities,
  estimateContainerRunCreditMicros,
  resolveContainerInstanceType,
  emitInfraUsage,
  finishUsageReservation,
  holdUsageReservation,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  SANDBOX_TIMEOUT_DEFAULT_SECONDS,
  SANDBOX_WORKSPACE_INSTANCE_TYPE,
  SANDBOX_TIMEOUT_MAX_SECONDS,
  type SandboxRunUsageReport,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { createUsageRuntime, createUsageStore } from "~/modules/usage/application/runtime";
import type { IEnv } from "~/types";

import { persistSandboxRunArtifact } from "./run-artifacts";
import { getSandboxRunRecordForUser } from "./runs";

const logger = getLogger({ prefix: "services/apps/sandbox/usage" });

const RESERVATION_EXPIRY_BUFFER_SECONDS = 600;
const DURATION_CLAMP_MULTIPLIER = 1.25;

export async function reserveSandboxRun(params: {
  env: IEnv;
  repositories: Repositories;
  userId: number;
  runId: string;
  timeoutSeconds?: number;
  workspaceId?: string | null;
}): Promise<void> {
  let held = !params.workspaceId;

  try {
    const timeoutSeconds = params.timeoutSeconds ?? SANDBOX_TIMEOUT_DEFAULT_SECONDS;
    const instanceType = SANDBOX_WORKSPACE_INSTANCE_TYPE;
    const creditMicros = estimateContainerRunCreditMicros(instanceType, timeoutSeconds);
    const expiresAt = new Date(
      Date.now() + (timeoutSeconds + RESERVATION_EXPIRY_BUFFER_SECONDS) * 1000,
    ).toISOString();

    held = await holdUsageReservation(
      createUsageRuntime({ env: params.env, repositories: params.repositories }),
      {
        userId: params.userId,
        kind: "sandbox",
        refId: params.runId,
        creditMicros,
        expiresAt,
        workspaceId: params.workspaceId,
      },
    );
  } catch (error) {
    logger.error("Failed to reserve credits for a sandbox run", {
      error,
      runId: params.runId,
      userId: params.userId,
    });
  }

  if (params.workspaceId && !held) {
    throw new AssistantError(
      "This workspace's shared credits can't cover this run, so it didn't start.",
      ErrorType.USAGE_LIMIT_ERROR,
    );
  }
}

export async function releaseSandboxRunReservation(params: {
  repositories: Repositories;
  runId: string;
}): Promise<void> {
  try {
    await finishUsageReservation(
      { store: createUsageStore(params.repositories) },
      { kind: "sandbox", refId: params.runId, outcome: "released" },
    );
  } catch (error) {
    logger.error("Failed to release a sandbox run reservation", { error, runId: params.runId });
  }
}

export async function recordSandboxRunUsage(params: {
  context: ServiceContext;
  userId: number;
  runId: string;
  report: SandboxRunUsageReport;
}): Promise<{ settled: boolean }> {
  const { context, userId, runId, report } = params;

  const record = await getSandboxRunRecordForUser({ context, userId, runId });
  const configuredTimeout = record.run.timeoutSeconds ?? SANDBOX_TIMEOUT_MAX_SECONDS;
  const maxBillableSeconds = Math.min(
    SANDBOX_TIMEOUT_MAX_SECONDS * DURATION_CLAMP_MULTIPLIER,
    configuredTimeout * DURATION_CLAMP_MULTIPLIER + RESERVATION_EXPIRY_BUFFER_SECONDS,
  );
  const durationSeconds = Math.min(Math.max(0, report.durationSeconds), maxBillableSeconds);
  const instanceType = resolveContainerInstanceType(report.instanceType);
  const quantities = containerSecondQuantities(instanceType, durationSeconds);

  const runtime = createUsageRuntime({
    env: context.env,
    repositories: context.repositories,
    publisher: context,
  });

  const held = await runtime.store.getReservation("sandbox", runId);

  await emitInfraUsage(runtime, {
    userId,
    scopeKey: `sandbox:${runId}`,
    quantities,
    occurredAt: report.endedAt,
    activityId: runId,
    runId: record.run.chatRunId ?? null,
    runAttempt: record.run.chatRunAttempt ?? null,
    delivery: record.run.chatRunId ? "inline" : undefined,
    projectId: record.projectId ?? null,
    workspaceId: record.projectId
      ? await runtime.store.getProjectWorkspaceId(record.projectId)
      : null,
    poolWorkspaceId: held?.workspace_id ?? null,
    raw: { ...report, durationSeconds, instanceType },
  });

  const reservation = await finishUsageReservation(runtime, {
    kind: "sandbox",
    refId: runId,
    outcome: "settled",
  });

  const runWithUsage = {
    ...record.run,
    infrastructureUsage: { instanceType, durationSeconds },
  };
  const isTerminal = ["completed", "failed", "cancelled"].includes(runWithUsage.status);
  const persistedRun = isTerminal
    ? await persistSandboxRunArtifact({
        serviceContext: context,
        ownerUserId: record.createdByUserId,
        projectId: record.projectId,
        conversationId: record.conversationId,
        run: runWithUsage,
      })
    : runWithUsage;

  await context.repositories
    .get(ActivityRepository)
    .updateActivity(record.id, { data: persistedRun });

  return { settled: reservation !== null };
}

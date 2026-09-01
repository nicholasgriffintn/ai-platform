import {
  SANDBOX_TIMEOUT_DEFAULT_SECONDS,
  SANDBOX_TIMEOUT_MAX_SECONDS,
  type SandboxRunUsageReport,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  containerSecondQuantities,
  estimateContainerRunCreditMicros,
  resolveContainerInstanceType,
} from "~/lib/usage/containerUsage";
import { emitInfraUsage } from "~/lib/usage/infraUsage";
import { finishUsageReservation, holdUsageReservation } from "~/lib/usage/reservations";
import type { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import { getSandboxRunRecordForUser } from "./runs";

const logger = getLogger({ prefix: "services/apps/sandbox/usage" });

const RESERVATION_EXPIRY_BUFFER_SECONDS = 600;
const DURATION_CLAMP_MULTIPLIER = 1.25;

export async function reserveSandboxRun(params: {
  env: IEnv;
  repositories: RepositoryManager;
  userId: number;
  runId: string;
  timeoutSeconds?: number;
}): Promise<void> {
  try {
    const timeoutSeconds = params.timeoutSeconds ?? SANDBOX_TIMEOUT_DEFAULT_SECONDS;
    const instanceType = resolveContainerInstanceType(params.env.SANDBOX_INSTANCE_TYPE);
    const creditMicros = estimateContainerRunCreditMicros(instanceType, timeoutSeconds);
    const expiresAt = new Date(
      Date.now() + (timeoutSeconds + RESERVATION_EXPIRY_BUFFER_SECONDS) * 1000,
    ).toISOString();

    await holdUsageReservation({
      repositories: params.repositories,
      userId: params.userId,
      kind: "sandbox",
      refId: params.runId,
      creditMicros,
      expiresAt,
    });
  } catch (error) {
    logger.error("Failed to reserve credits for a sandbox run", {
      error,
      runId: params.runId,
      userId: params.userId,
    });
  }
}

export async function releaseSandboxRunReservation(params: {
  repositories: RepositoryManager;
  runId: string;
}): Promise<void> {
  try {
    await finishUsageReservation({
      repositories: params.repositories,
      kind: "sandbox",
      refId: params.runId,
      outcome: "released",
    });
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

  await emitInfraUsage({
    env: context.env,
    repositories: context.repositories,
    userId,
    scopeKey: `sandbox:${runId}`,
    quantities,
    occurredAt: report.endedAt,
    activityId: runId,
    raw: { ...report, durationSeconds, instanceType },
  });

  const reservation = await finishUsageReservation({
    repositories: context.repositories,
    kind: "sandbox",
    refId: runId,
    outcome: "settled",
  });

  return { settled: reservation !== null };
}

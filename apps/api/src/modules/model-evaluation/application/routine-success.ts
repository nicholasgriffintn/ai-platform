import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  listPageOf,
  ROUTINE_SUCCESS_WINDOW_DAYS,
  type RoutineSuccess,
  type RoutineSuccessListResponse,
  type RunVerificationStatus,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  RoutineOutcomeRepository,
  type RoutineOutcomeSummaryRow,
} from "../infrastructure/RoutineOutcomeRepository";

const logger = getLogger({ prefix: "model-evaluation/routine-success" });
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRoutineSuccess(row: RoutineOutcomeSummaryRow): RoutineSuccess {
  const verified = Math.max(row.verified - row.false_completions, 0);

  return {
    routineId: row.routine_id,
    kind: row.routine_kind,
    windowDays: ROUTINE_SUCCESS_WINDOW_DAYS,
    runs: row.runs,
    verified,
    unverified: row.unverified,
    failed: row.failed,
    falseCompletions: row.false_completions,
    successRate: row.runs > 0 ? verified / row.runs : 0,
    lastStatus: row.last_status,
    lastRunAt: row.last_run_at,
  };
}

export async function listRoutineSuccess(
  context: ServiceContext,
  now = new Date(),
): Promise<RoutineSuccessListResponse> {
  const user = context.requireUser();
  const since = new Date(now.getTime() - ROUTINE_SUCCESS_WINDOW_DAYS * DAY_MS).toISOString();
  const rows = await context.repositories.get(RoutineOutcomeRepository).summarise(user.id, since);

  return listPageOf(rows.map(formatRoutineSuccess), (routine) => routine.routineId);
}

async function quietly(action: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    logger.warn(`Could not ${action}`, { error: getErrorMessage(error, "Unknown error") });
  }
}

export function openLeadRoutineOutcome(
  context: ServiceContext,
  input: {
    taskId: string;
    userId: number;
    projectId: string;
    routineId: string;
    occurredAt: string;
  },
): Promise<void> {
  return quietly("open a routine outcome", () =>
    context.repositories.get(RoutineOutcomeRepository).record({
      id: input.taskId,
      userId: input.userId,
      projectId: input.projectId,
      kind: "lead",
      routineId: input.routineId,
      runId: null,
      status: "pending",
      occurredAt: input.occurredAt,
    }),
  );
}

export function settleRoutineOutcome(
  context: ServiceContext,
  input: { taskId: string; runId: string | null; status: RunVerificationStatus },
): Promise<void> {
  return quietly("settle a routine outcome", () =>
    context.repositories.get(RoutineOutcomeRepository).settle({
      id: input.taskId,
      runId: input.runId,
      status: input.status,
      occurredAt: new Date().toISOString(),
    }),
  );
}

export function recordRecipeRoutineOutcome(
  context: ServiceContext,
  input: {
    taskId: string;
    userId: number;
    projectId: string | null;
    installationId: string;
    runId: string | null;
    status: RunVerificationStatus;
    occurredAt: string;
  },
): Promise<void> {
  return quietly("record a routine outcome", () =>
    context.repositories.get(RoutineOutcomeRepository).record({
      id: input.taskId,
      userId: input.userId,
      projectId: input.projectId,
      kind: "recipe",
      routineId: input.installationId,
      runId: input.runId,
      status: input.status,
      occurredAt: input.occurredAt,
    }),
  );
}

export function recordRoutineFalseCompletion(
  context: ServiceContext,
  taskId: string,
): Promise<void> {
  return quietly("record a false completion", () =>
    context.repositories.get(RoutineOutcomeRepository).markFalseCompletion(taskId),
  );
}

import {
  evaluateGoalContinuation,
  isTerminalGoalStatus,
  type Goal,
  type GoalEvidenceEntry,
  type GoalOwner,
  type GoalProgressEntry,
  type GoalSource,
  type GoalStatus,
  type GoalSurface,
} from "@ngriffin_uk/polychat-schemas";

import type { GoalRepository } from "~/repositories/GoalRepository";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const PROGRESS_JOURNAL_LIMIT = 40;

export type GoalActor = "user" | "model" | "system";

const ALLOWED_TRANSITIONS: Record<GoalActor, GoalStatus[]> = {
  user: ["active", "paused", "cleared"],
  model: ["completed"],
  system: ["blocked", "stalled", "limit_reached"],
};

export interface RecordIterationParams {
  surface: GoalSurface;
  summary: string;
  evidence?: string[];
  next?: string;
  tokens?: number;
  producedEvidence: boolean;
  calledTool: boolean;
  awaitingUserAction?: "approval" | "question";
  usageLimitsExhausted?: boolean;
}

export class GoalService {
  constructor(private readonly goals: GoalRepository) {}

  assertPro(user: IUser | null | undefined): void {
    if (!user?.id) {
      throw new AssistantError("User not authenticated", ErrorType.AUTHENTICATION_ERROR);
    }

    if (user.plan_id !== "pro") {
      throw new AssistantError(
        `Goals require a pro plan. Your current plan is ${user.plan_id || "free"}.`,
        ErrorType.AUTHORISATION_ERROR,
      );
    }
  }

  async getActiveGoal(owner: GoalOwner): Promise<Goal | null> {
    return this.goals.getActiveGoal(owner);
  }

  async getGoalById(goalId: string): Promise<Goal | null> {
    return this.goals.getGoalById(goalId);
  }

  async setGoal(params: {
    owner: GoalOwner;
    user: IUser;
    objective: string;
    source: GoalSource;
    createdFromMessageId?: string;
  }): Promise<Goal> {
    this.assertPro(params.user);

    const reuseActiveGoal = async (): Promise<Goal | undefined> => {
      const existing = await this.goals.getActiveGoal(params.owner);

      if (!existing) {
        return undefined;
      }

      const updated = await this.goals.updateGoal(existing.id, {
        objective: params.objective,
        status: "active",
        stallStreak: 0,
        stoppedReason: null,
      });

      if (!updated) {
        throw new AssistantError("Failed to update the goal", ErrorType.DATABASE_ERROR);
      }

      return updated;
    };

    const existing = await reuseActiveGoal();

    if (existing) {
      return existing;
    }

    try {
      return await this.goals.createGoal({
        owner: params.owner,
        userId: params.user.id,
        objective: params.objective,
        source: params.source,
        createdFromMessageId: params.createdFromMessageId,
      });
    } catch (error) {
      const raced = await reuseActiveGoal();

      if (!raced) {
        throw error;
      }

      return raced;
    }
  }

  async transition(params: {
    goalId: string;
    actor: GoalActor;
    status: GoalStatus;
    reason?: string;
    evidence?: GoalEvidenceEntry[];
  }): Promise<Goal> {
    const goal = await this.goals.getGoalById(params.goalId);

    if (!goal) {
      throw new AssistantError("Goal not found", ErrorType.NOT_FOUND);
    }

    if (!ALLOWED_TRANSITIONS[params.actor].includes(params.status)) {
      throw new AssistantError(
        `A ${params.actor} may not move a goal to ${params.status}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    if (isTerminalGoalStatus(goal.status)) {
      throw new AssistantError(`This goal already ended as ${goal.status}`, ErrorType.PARAMS_ERROR);
    }

    const updated = await this.goals.updateGoal(
      goal.id,
      {
        status: params.status,
        stoppedReason: params.reason ?? null,
        ...(params.evidence ? { evidence: params.evidence } : {}),
        ...(params.status === "completed" ? { completedAt: new Date().toISOString() } : {}),
        ...(params.status === "active" ? { stallStreak: 0 } : {}),
      },
      { expectedStatus: goal.status },
    );

    if (!updated) {
      throw new AssistantError("Failed to update the goal", ErrorType.DATABASE_ERROR);
    }

    return updated;
  }

  async completeGoal(params: {
    goalId: string;
    evidence: GoalEvidenceEntry[];
    summary: string;
  }): Promise<Goal> {
    if (params.evidence.length === 0) {
      throw new AssistantError(
        "Completing a goal requires an evidence ledger",
        ErrorType.PARAMS_ERROR,
      );
    }

    const current = await this.goals.getGoalById(params.goalId);

    if (!current) {
      throw new AssistantError("Goal not found", ErrorType.NOT_FOUND);
    }

    if (current.status !== "active") {
      throw new AssistantError(
        `This goal is ${current.status} and cannot be completed`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const recorded = await this.goals.updateGoal(
      current.id,
      {
        iterationCount: current.iteration_count + 1,
        progress: appendProgress(current.progress, {
          iteration: current.iteration_count + 1,
          surface: current.conversation_id ? "agent" : "sandbox",
          summary: params.summary,
          evidence: params.evidence.map((entry) => entry.claim),
          at: new Date().toISOString(),
        }),
        lastContinuedAt: new Date().toISOString(),
      },
      { expectedStatus: "active" },
    );

    if (!recorded) {
      throw new AssistantError("Failed to record goal completion", ErrorType.DATABASE_ERROR);
    }

    if (params.evidence.some((entry) => entry.status === "blocked")) {
      return this.transition({
        goalId: params.goalId,
        actor: "system",
        status: "blocked",
        reason: params.summary,
        evidence: params.evidence,
      });
    }

    return this.transition({
      goalId: params.goalId,
      actor: "model",
      status: "completed",
      reason: params.summary,
      evidence: params.evidence,
    });
  }

  async steer(params: {
    goalId: string;
    instruction: string;
    surface: GoalSurface;
  }): Promise<Goal> {
    const goal = await this.goals.getGoalById(params.goalId);

    if (!goal || isTerminalGoalStatus(goal.status)) {
      throw new AssistantError("No active goal to steer", ErrorType.PARAMS_ERROR);
    }

    const progress = appendProgress(goal.progress, {
      iteration: goal.iteration_count,
      surface: params.surface,
      summary: "Steered by the user",
      evidence: [],
      steer: params.instruction,
      at: new Date().toISOString(),
    });

    const updated = await this.goals.updateGoal(goal.id, {
      progress,
      stallStreak: 0,
    });

    if (!updated) {
      throw new AssistantError("Failed to record the steer", ErrorType.DATABASE_ERROR);
    }

    return updated;
  }

  /**
   * Records one unit of work against the goal and decides what happens next.
   * The continuation rule itself lives in the schemas package so the client
   * dispatcher and the sandbox coordinator apply exactly the same policy.
   */
  async recordIteration(params: {
    goalId: string;
    iteration: RecordIterationParams;
  }): Promise<{ goal: Goal; shouldContinue: boolean; transitioned: boolean }> {
    const { iteration } = params;
    const goal = await this.goals.getGoalById(params.goalId);

    if (!goal) {
      throw new AssistantError("Goal not found", ErrorType.NOT_FOUND);
    }

    if (goal.status !== "active") {
      return { goal, shouldContinue: false, transitioned: false };
    }

    const decision = evaluateGoalContinuation({
      goal,
      lastTurn: {
        producedEvidence: iteration.producedEvidence,
        calledTool: iteration.calledTool,
        aborted: false,
        awaitingApproval: iteration.awaitingUserAction !== undefined,
      },
      usageLimitsExhausted: iteration.usageLimitsExhausted === true,
      queuedInstructionCount: 0,
      otherWorkInFlight: false,
    });

    const progress = appendProgress(goal.progress, {
      iteration: goal.iteration_count + 1,
      surface: iteration.surface,
      summary: iteration.summary,
      evidence: iteration.evidence ?? [],
      next: iteration.next,
      at: new Date().toISOString(),
    });

    const nextStatus: GoalStatus | undefined =
      decision.reason === "stalled"
        ? "stalled"
        : decision.reason === "usage-limits"
          ? "limit_reached"
          : decision.reason === "awaiting-approval"
            ? "blocked"
            : undefined;

    const updated = await this.goals.updateGoal(
      goal.id,
      {
        iterationCount: goal.iteration_count + 1,
        stallStreak: decision.nextStallStreak,
        tokensSpent: goal.tokens_spent + (iteration.tokens ?? 0),
        progress,
        lastContinuedAt: new Date().toISOString(),
        ...(nextStatus
          ? {
              status: nextStatus,
              stoppedReason: stoppedReasonFor(nextStatus, iteration.awaitingUserAction),
            }
          : {}),
      },
      { expectedStatus: "active" },
    );

    if (!updated) {
      const latest = await this.goals.getGoalById(goal.id);

      if (!latest) {
        throw new AssistantError("Goal not found", ErrorType.NOT_FOUND);
      }

      return { goal: latest, shouldContinue: false, transitioned: false };
    }

    return {
      goal: updated,
      shouldContinue: decision.shouldContinue,
      transitioned: nextStatus !== undefined,
    };
  }
}

function stoppedReasonFor(
  status: GoalStatus,
  awaitingUserAction?: "approval" | "question",
): string {
  if (status === "stalled") {
    return "Consecutive continuations produced no new evidence.";
  }

  if (status === "limit_reached") {
    return "The account's usage limits were reached.";
  }

  return awaitingUserAction === "question"
    ? "The work is waiting for your answers."
    : "The work is waiting for your approval.";
}

function appendProgress(
  progress: GoalProgressEntry[],
  entry: GoalProgressEntry,
): GoalProgressEntry[] {
  return [...progress, entry].slice(-PROGRESS_JOURNAL_LIMIT);
}

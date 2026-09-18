import {
  appendGoalProgressEntry,
  assertGoalTransition,
  isTerminalGoalStatus,
  planGoalIteration,
  type GoalActor,
} from "@ngriffin_uk/polychat-library-goals";
import type {
  Goal,
  GoalEvidenceEntry,
  GoalOwner,
  GoalSource,
  GoalStatus,
  GoalSurface,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import type { IUser } from "~/types";

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

export interface GoalServiceOptions {
  onChanged?: (goal: Goal) => void;
}

export class GoalService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly options: GoalServiceOptions = {},
  ) {}

  private async createGoal(...args: Parameters<GoalRepository["createGoal"]>): Promise<Goal> {
    const goal = await this.goals.createGoal(...args);

    this.options.onChanged?.(goal);

    return goal;
  }

  private async updateGoal(
    ...args: Parameters<GoalRepository["updateGoal"]>
  ): Promise<Goal | null> {
    const goal = await this.goals.updateGoal(...args);

    if (goal) {
      this.options.onChanged?.(goal);
    }

    return goal;
  }

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

      const updated = await this.updateGoal(existing.id, {
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
      return await this.createGoal({
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

    assertGoalTransition({ actor: params.actor, from: goal.status, to: params.status });

    const updated = await this.updateGoal(
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

    const recorded = await this.updateGoal(
      current.id,
      {
        iterationCount: current.iteration_count + 1,
        progress: appendGoalProgressEntry(current.progress, {
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

    const progress = appendGoalProgressEntry(goal.progress, {
      iteration: goal.iteration_count,
      surface: params.surface,
      summary: "Steered by the user",
      evidence: [],
      steer: params.instruction,
      at: new Date().toISOString(),
    });

    const updated = await this.updateGoal(goal.id, {
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
   * The continuation policy lives in library-goals so the client dispatcher and
   * the sandbox coordinator apply exactly the same rule.
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

    const plan = planGoalIteration({
      goal,
      iteration: {
        producedEvidence: iteration.producedEvidence,
        calledTool: iteration.calledTool,
        awaitingUserAction: iteration.awaitingUserAction,
        usageLimitsExhausted: iteration.usageLimitsExhausted,
      },
    });

    const progress = appendGoalProgressEntry(goal.progress, {
      iteration: goal.iteration_count + 1,
      surface: iteration.surface,
      summary: iteration.summary,
      evidence: iteration.evidence ?? [],
      next: iteration.next,
      at: new Date().toISOString(),
    });

    const updated = await this.updateGoal(
      goal.id,
      {
        iterationCount: goal.iteration_count + 1,
        stallStreak: plan.stallStreak,
        tokensSpent: goal.tokens_spent + (iteration.tokens ?? 0),
        progress,
        lastContinuedAt: new Date().toISOString(),
        ...(plan.status
          ? {
              status: plan.status,
              stoppedReason: plan.stoppedReason ?? null,
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
      shouldContinue: plan.shouldContinue,
      transitioned: plan.status !== undefined,
    };
  }
}

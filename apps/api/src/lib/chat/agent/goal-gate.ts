import type { AgentFinishAssessment } from "@ngriffin_uk/polychat-library-agent-core";
import {
  goalSchema,
  isTerminalGoalStatus,
  type Goal,
  type GoalSurface,
} from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import { isUsageExhausted } from "~/lib/usage/limitState";
import type { GoalService } from "~/services/goals/GoalService";

export interface GoalGateParams {
  goalService: GoalService;
  goal?: Goal | null;
  surface: GoalSurface;
  conversationManager?: Pick<ConversationManager, "getUsageLimits">;
  onTerminalStatus?: (goal: Goal) => Promise<void>;
}

interface GoalToolResult {
  role?: string;
  name?: string;
  status?: string;
  content?: unknown;
  data?: unknown;
}

export interface GoalFinishGate {
  assessFinish(context: {
    summary: string;
    step: number;
    commandCount: number;
    awaitingUserAction?: "approval" | "question";
  }): Promise<AgentFinishAssessment>;
  observeToolResult(result: GoalToolResult): Promise<void>;
  hasActiveGoal(): boolean;
}

export const GOAL_UNSATISFIED_INSTRUCTION = [
  "The active goal is not satisfied yet. Nobody is speaking to you; this is the goal tracker.",
  "Audit the objective against the evidence in this thread: files changed, commands run, tool results, artifacts produced.",
  "Do not apologise or address the user about this check. Just carry on with the work.",
  "Only call complete_goal once every part of the objective is done; a ledger covering part of it is not a completion.",
  "If no defensible path remains, say what was tried, what blocked it, and what would unblock it.",
  "Otherwise take the single next best action.",
].join(" ");

export function createGoalFinishGate(params: GoalGateParams): GoalFinishGate {
  let currentGoal = params.goal ?? null;
  let lastCommandCount = 0;
  const reportedTransitions = new Set<string>();

  const reportTransition = async (goal: Goal) => {
    const transition = `${goal.id}:${goal.status}`;

    if (!isTerminalGoalStatus(goal.status) || reportedTransitions.has(transition)) {
      return;
    }

    reportedTransitions.add(transition);
    await params.onTerminalStatus?.(goal);
  };

  const assessFinish: GoalFinishGate["assessFinish"] = async (context) => {
    if (!currentGoal || currentGoal.status !== "active") {
      return {
        allow: true,
        outcome: currentGoal?.status === "completed" ? "satisfied" : "unsatisfied",
      };
    }

    const calledTool = context.commandCount > lastCommandCount;

    lastCommandCount = context.commandCount;

    const usageLimitsExhausted = params.conversationManager
      ? await isUsageExhausted(params.conversationManager)
      : false;
    const { goal, shouldContinue, transitioned } = await params.goalService.recordIteration({
      goalId: currentGoal.id,
      iteration: {
        surface: params.surface,
        summary: context.summary || "Model returned without calling a tool",
        evidence: [],
        producedEvidence: calledTool,
        calledTool,
        awaitingUserAction: context.awaitingUserAction,
        usageLimitsExhausted,
      },
    });

    currentGoal = goal;

    if (!shouldContinue) {
      if (transitioned) {
        await reportTransition(goal);
      }

      return {
        allow: true,
        outcome:
          goal.status === "stalled"
            ? "stalled"
            : goal.status === "blocked"
              ? "blocked"
              : "unsatisfied",
      };
    }

    return { allow: false, instruction: GOAL_UNSATISFIED_INSTRUCTION };
  };

  const observeToolResult: GoalFinishGate["observeToolResult"] = async (result) => {
    if (
      result.status !== "success" ||
      (result.name !== "set_goal" && result.name !== "complete_goal")
    ) {
      return;
    }

    const parsed = goalSchema.safeParse(
      typeof result.data === "object" && result.data !== null && "goal" in result.data
        ? result.data.goal
        : undefined,
    );

    if (!parsed.success) {
      return;
    }

    currentGoal = parsed.data;

    if (result.name === "complete_goal") {
      await reportTransition(currentGoal);
    }
  };

  return {
    assessFinish,
    observeToolResult,
    hasActiveGoal: () => currentGoal?.status === "active",
  };
}

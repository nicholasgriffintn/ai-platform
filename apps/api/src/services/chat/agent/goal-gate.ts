import type { AgentFinishAssessment } from "@ngriffin_uk/polychat-ai-agents";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { isTerminalGoalStatus } from "@ngriffin_uk/polychat-library-goals";
import { goalSchema, type Goal, type GoalSurface } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/services/conversations/manager";
import type { GoalService } from "~/services/goals/GoalService";
import { isUsageExhausted } from "~/services/usage/limitState";

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

export const GOAL_UNSATISFIED_INSTRUCTION = getPromptText("apps/goal/incomplete-instruction");

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

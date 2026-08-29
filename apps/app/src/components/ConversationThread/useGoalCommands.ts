import type { GoalCommand } from "@ngriffin_uk/polychat-library-chat/goal-command";
import type { GoalStatus } from "@ngriffin_uk/polychat-schemas";
import { goalStatusLabels } from "@ngriffin_uk/polychat-schemas/goals";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useGoal, GOAL_QUERY_KEY } from "~/hooks/useGoal";
import { apiService } from "~/lib/api/api-service";
import { getErrorMessage } from "~/lib/errors";

export interface GoalView {
  objective: string;
  status: GoalStatus;
  statusLabel: string;
  iterationCount: number;
  stoppedReason: string | null;
}

export interface UseGoalCommandsResult {
  goalView: GoalView | null;
  canUseGoals: boolean;
  busy: boolean;
  goalState: {
    canUseGoals: boolean;
    goal: { status: string } | null;
    onCommand: (command: GoalCommand) => void;
  };
  handleGoalCommand: (command: GoalCommand) => Promise<boolean>;
  setGoalOnConversation: (
    conversationId: string,
    objective: string,
    projectId?: string,
  ) => Promise<boolean>;
}

export function useGoalCommands(conversationId: string | undefined): UseGoalCommandsResult {
  const queryClient = useQueryClient();
  const { goal, canUseGoals, setGoal, updateGoal } = useGoal(conversationId);
  const setGoalAsync = setGoal.mutateAsync;
  const updateGoalAsync = updateGoal.mutateAsync;

  const goalView = useMemo<GoalView | null>(
    () =>
      goal
        ? {
            objective: goal.objective,
            status: goal.status,
            statusLabel: goalStatusLabels[goal.status],
            iterationCount: goal.iteration_count,
            stoppedReason: goal.stopped_reason ?? null,
          }
        : null,
    [goal],
  );

  const handleGoalCommand = useCallback(
    async (command: GoalCommand): Promise<boolean> => {
      if (!canUseGoals) {
        toast.error("Goals are a Pro feature.");

        return false;
      }

      if (!conversationId) {
        toast.error("Send the objective as a message to start a goal.");

        return false;
      }

      try {
        if (command.kind === "status") {
          toast.message(
            goal
              ? `${goalStatusLabels[goal.status]}: ${goal.objective}`
              : "No goal on this conversation yet.",
          );

          return true;
        }

        if (command.kind === "set") {
          const next = await setGoalAsync(command.objective);

          toast.success(next ? `Goal set: ${next.objective}` : "Goal set.");

          return true;
        }

        if (!goal) {
          toast.error("No goal on this conversation yet.");

          return false;
        }

        const status =
          command.kind === "pause" ? "paused" : command.kind === "resume" ? "active" : "cleared";
        const next = await updateGoalAsync(status);

        toast.success(
          command.kind === "clear" ? "Goal cleared." : goalStatusLabels[next?.status ?? status],
        );

        return true;
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not update the goal"));

        return false;
      }
    },
    [canUseGoals, conversationId, goal, setGoalAsync, updateGoalAsync],
  );

  const setGoalOnConversation = useCallback(
    async (
      targetConversationId: string,
      objective: string,
      projectId?: string,
    ): Promise<boolean> => {
      try {
        const next = await apiService.setConversationGoal(
          targetConversationId,
          objective,
          projectId,
        );

        queryClient.setQueryData([GOAL_QUERY_KEY, targetConversationId], next ?? null);
        toast.success(next ? `Goal set: ${next.objective}` : "Goal set.");

        return true;
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not set the goal"));

        return false;
      }
    },
    [queryClient],
  );

  const goalState = useMemo(
    () => ({
      canUseGoals,
      goal: goalView ? { status: goalView.status } : null,
      onCommand: (command: GoalCommand) => void handleGoalCommand(command),
    }),
    [canUseGoals, goalView, handleGoalCommand],
  );

  return {
    goalView,
    canUseGoals,
    busy: setGoal.isPending || updateGoal.isPending,
    goalState,
    handleGoalCommand,
    setGoalOnConversation,
  };
}

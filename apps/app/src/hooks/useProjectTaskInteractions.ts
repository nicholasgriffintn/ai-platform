import { CHATS_QUERY_KEY } from "@ngriffin_uk/polychat-library-client";
import {
  answerUserQuestionsSchema,
  resolveProjectTaskToolApprovalSchema,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { getErrorMessage } from "~/lib/errors";

import { useProjectTask, useProjectTasks } from "./useProjectTasks";

export function useProjectTaskInteractions(projectId: string, currentConversationId?: string) {
  const queryClient = useQueryClient();
  const { tasks, answer, approval } = useProjectTasks(projectId);
  const conversationTask = tasks.find((task) => task.conversationId === currentConversationId);
  const pendingTask = tasks.find(
    (task) =>
      task.conversationId === currentConversationId &&
      task.status === "blocked" &&
      task.blockedReason === "awaiting_input",
  );
  const pendingTaskQuery = useProjectTask(projectId, pendingTask?.id ?? "");
  const pendingApprovalTask = tasks.find(
    (task) =>
      task.conversationId === currentConversationId &&
      task.status === "blocked" &&
      task.blockedReason === "awaiting_approval",
  );

  const handleTaskQuestionInteraction = useCallback<
    NonNullable<ConversationThreadModeConfig["onToolInteraction"]>
  >(
    async (toolName, action, data) => {
      if (action !== "submitPrompt") {
        return false;
      }

      if (pendingApprovalTask) {
        const parsedApproval = resolveProjectTaskToolApprovalSchema.safeParse(data);

        if (!parsedApproval.success) {
          return false;
        }

        try {
          await approval.mutateAsync({
            taskId: pendingApprovalTask.id,
            input: parsedApproval.data,
          });
          await queryClient.invalidateQueries({
            queryKey: [CHATS_QUERY_KEY, currentConversationId],
          });
          toast.success(
            parsedApproval.data.resolution === "approved"
              ? "Approved. The task is continuing."
              : "Rejected. The task is continuing without that tool.",
          );
        } catch (mutationError) {
          toast.error(getErrorMessage(mutationError, "Unable to continue this task"));
          throw mutationError;
        }

        return true;
      }

      if (toolName !== "ask_user" || !pendingTask) {
        return false;
      }

      const parsed = answerUserQuestionsSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error("The answers could not be read. Refresh the conversation and try again.");
      }

      try {
        await answer.mutateAsync({ taskId: pendingTask.id, input: parsed.data });
        await queryClient.invalidateQueries({
          queryKey: [CHATS_QUERY_KEY, currentConversationId],
        });
        toast.success("Answers sent. The task is continuing.");
      } catch (mutationError) {
        toast.error(getErrorMessage(mutationError, "Unable to continue this task"));
        throw mutationError;
      }

      return true;
    },
    [answer, approval, currentConversationId, pendingApprovalTask, pendingTask, queryClient],
  );

  return {
    conversationTask,
    onToolInteraction: handleTaskQuestionInteraction,
    pendingQuestions: pendingTaskQuery.data?.pendingQuestions ?? null,
  };
}

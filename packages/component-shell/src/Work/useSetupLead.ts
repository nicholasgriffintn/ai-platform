import { useProjectTask, useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import { isProjectTaskAwaitingInput, isProjectTaskRetryable } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export function useSetupLead(projectId: string, taskId: string) {
  const detail = useProjectTask(projectId, taskId);
  const { start } = useProjectTasks(projectId);
  const task = detail.data?.task ?? null;
  const stopped = task?.status === "blocked" ? task : null;

  return {
    stopped,
    needsInput: stopped ? isProjectTaskAwaitingInput(stopped) : false,
    canRetry: stopped ? isProjectTaskRetryable(stopped) : false,
    isRetrying: start.isPending,
    retry: () => {
      if (!stopped) {
        return;
      }

      void start
        .mutateAsync(stopped.id)
        .then(() => toast.success("The lead is trying again"))
        .catch((error: unknown) =>
          toast.error(getErrorMessage(error, "The lead could not start again")),
        );
    },
  };
}

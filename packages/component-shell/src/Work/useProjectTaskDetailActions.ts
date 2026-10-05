import { useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import type { ProjectFlowWait, ResolveProjectFlowWaitInput } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export function useProjectTaskDetailActions(
  projectId: string,
  taskId: string,
  onDeleted: () => void,
) {
  const tasks = useProjectTasks(projectId);
  const [waitError, setWaitError] = useState<string>();
  const { start, respondToWait, update, remove } = tasks;
  const run = async () => {
    try {
      await start.mutateAsync(taskId);
      toast.success("Task continued");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to run this task"));
    }
  };

  const cancel = async () => {
    try {
      await update.mutateAsync({ taskId, input: { status: "cancelled" } });
      toast.success("Task cancelled");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to cancel this task"));
    }
  };

  const respond = async (wait: ProjectFlowWait, input: ResolveProjectFlowWaitInput) => {
    setWaitError(undefined);
    try {
      await respondToWait.mutateAsync({ taskId, waitId: wait.id, input });
      toast.success("Review saved");

      return true;
    } catch (error) {
      setWaitError(getErrorMessage(error, "Unable to save this review"));

      return false;
    }
  };

  const deleteTask = async () => {
    try {
      await remove.mutateAsync(taskId);
      toast.success("Task deleted");
      onDeleted();
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete this task"));
    }
  };

  return {
    ...tasks,
    run,
    cancel,
    respond,
    deleteTask,
    waitError,
    isBusy: start.isPending || respondToWait.isPending || update.isPending || remove.isPending,
  };
}

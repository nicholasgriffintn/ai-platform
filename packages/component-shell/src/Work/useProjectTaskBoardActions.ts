import type { CreateTaskInput, CreateTaskIntent } from "@ngriffin_uk/polychat-component-workspaces";
import { useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export function useProjectTaskBoardActions({
  projectId,
  onTaskCreated,
}: {
  projectId: string;
  onTaskCreated: () => void;
}) {
  const tasks = useProjectTasks(projectId);
  const { create, start } = tasks;

  const addTask = async (input: CreateTaskInput, intent: CreateTaskIntent) => {
    const { task } = await create.mutateAsync(input);

    if (intent === "save") {
      toast.success("Task added to the backlog");
      onTaskCreated();

      return;
    }

    try {
      await start.mutateAsync(task.id);
      toast.success("Task added and queued");
    } catch (error) {
      toast.error(
        `Task saved, but could not be started: ${getErrorMessage(error, "Try running it from the task board.")}`,
      );
    }

    onTaskCreated();
  };

  return { ...tasks, addTask };
}

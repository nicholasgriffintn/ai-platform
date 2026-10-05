import type { CreateTaskInput, CreateTaskIntent } from "@ngriffin_uk/polychat-component-workspaces";
import { useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import type { ProjectFlow, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export function useProjectTaskBoardActions({
  projectId,
  onTaskCreated,
  onFlowSaved,
}: {
  projectId: string;
  onTaskCreated: () => void;
  onFlowSaved: () => void;
}) {
  const tasks = useProjectTasks(projectId);
  const { create, start, saveFlow } = tasks;

  const runTask = async (task: ProjectTask) => {
    try {
      await start.mutateAsync(task.id);
      toast.success("Task queued");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to run this task"));
    }
  };

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

  const saveProjectFlow = async (flow: ProjectFlow) => {
    try {
      await saveFlow.mutateAsync(flow);
      onFlowSaved();
      toast.success("Project flow saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save the project flow"));
      throw error;
    }
  };

  return { ...tasks, runTask, addTask, saveProjectFlow };
}

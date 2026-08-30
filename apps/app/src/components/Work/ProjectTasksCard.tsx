import {
  CreateTaskDialog,
  ProjectTasksSummary,
  type CreateTaskInput,
  type CreateTaskIntent,
} from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";
import { toast } from "sonner";

import { useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage } from "~/lib/errors";

import { useProjectTaskAgents } from "./useProjectTaskAgents";
import { useWorkData } from "./WorkDataContext";

export function ProjectTasksCard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { projectQuery, workspaceQuery } = useWorkData();
  const agents = useProjectTaskAgents(projectQuery.data?.capabilities);
  const { tasks, flow, isLoading, create, start } = useProjectTasks(projectId);
  const boardHref = `/work/${workspaceId}/projects/${projectId}/tasks`;
  const members = (workspaceQuery.data?.members ?? []).map((member) => ({
    userId: member.userId,
    name: member.name,
  }));

  const taskHref = (task: ProjectTask) =>
    `/work/${workspaceId}/projects/${projectId}/tasks/${task.id}`;

  const addTask = async (input: CreateTaskInput, intent: CreateTaskIntent) => {
    try {
      const { task } = await create.mutateAsync(input);

      if (intent === "run") {
        await start.mutateAsync(task.id);
      }

      setIsCreateOpen(false);
      toast.success(intent === "run" ? "Task added and queued" : "Task added to the backlog");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to add this task"));
    }
  };

  return (
    <>
      <ProjectTasksSummary
        tasks={tasks}
        boardHref={boardHref}
        taskHref={taskHref}
        isLoading={isLoading}
        onCreateTask={() => setIsCreateOpen(true)}
      />
      <CreateTaskDialog
        open={isCreateOpen}
        flow={flow}
        members={members}
        agents={agents}
        boardTasks={tasks}
        isSubmitting={create.isPending || start.isPending}
        errorMessage={create.error ? getErrorMessage(create.error, "") : undefined}
        onOpenChange={setIsCreateOpen}
        onSubmit={addTask}
      />
    </>
  );
}

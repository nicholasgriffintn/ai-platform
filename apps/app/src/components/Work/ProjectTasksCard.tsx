import {
  CreateTaskDialog,
  ProjectTasksSummary,
  type CreateTaskInput,
} from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";
import { toast } from "sonner";

import { useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage } from "~/lib/errors";

import { useWorkData } from "./WorkContext";

export function ProjectTasksCard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspaceQuery } = useWorkData();
  const { tasks, flow, isLoading, create } = useProjectTasks(projectId);
  const boardHref = `/work/${workspaceId}/projects/${projectId}/tasks`;
  const members = (workspaceQuery.data?.members ?? []).map((member) => ({
    userId: member.userId,
    name: member.name,
  }));

  const taskHref = (task: ProjectTask) =>
    task.conversationId
      ? `/work/${workspaceId}/projects/${projectId}/chat?completion_id=${task.conversationId}`
      : boardHref;

  const addTask = async (input: CreateTaskInput) => {
    try {
      await create.mutateAsync(input);
      setIsCreateOpen(false);
      toast.success("Task added");
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
        isSubmitting={create.isPending}
        errorMessage={create.error ? getErrorMessage(create.error, "") : undefined}
        onOpenChange={setIsCreateOpen}
        onSubmit={addTask}
      />
    </>
  );
}

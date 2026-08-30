import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  CreateTaskDialog,
  TaskBoard,
  type CreateTaskInput,
} from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage, isAuthenticationError } from "~/lib/errors";

import { useProjectTaskAgents } from "./useProjectTaskAgents";
import { useWorkData } from "./WorkContext";

export function ProjectTaskBoard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { projectQuery, workspaceQuery } = useWorkData();
  const agents = useProjectTaskAgents(projectQuery.data?.capabilities);
  const { tasks, flow, isLoading, error, create, start, accept } = useProjectTasks(projectId);

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view this board"
        message="Sign in to see the tasks this project is working through."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  const members = (workspaceQuery.data?.members ?? []).map((member) => ({
    userId: member.userId,
    name: member.name,
  }));
  const pendingTaskIds = [
    ...(start.isPending && typeof start.variables === "string" ? [start.variables] : []),
    ...(accept.isPending && typeof accept.variables === "string" ? [accept.variables] : []),
  ];

  const taskHref = (task: ProjectTask) =>
    task.conversationId
      ? `/work/${workspaceId}/projects/${projectId}/chat?completion_id=${task.conversationId}`
      : `/work/${workspaceId}/projects/${projectId}/tasks`;

  const runTask = async (task: ProjectTask) => {
    try {
      await start.mutateAsync(task.id);
      toast.success("Task queued");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to run this task"));
    }
  };

  const acceptTask = async (task: ProjectTask) => {
    try {
      const { task: accepted } = await accept.mutateAsync(task.id);

      toast.success(accepted.status === "done" ? "Task accepted" : "Moved to the next stage");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to accept this task"));
    }
  };

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
      <PageShell.Content className="max-w-full">
        <PageShell.Header
          title="Tasks"
          actionContent={
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              Add a task
            </Button>
          }
        />
        <p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Work this project needs done. Run a task and the assistant works it in its own
          conversation, stopping at anything that needs you.
        </p>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading the board…</p>
        ) : error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{error.message}</p>
        ) : (
          <TaskBoard
            tasks={tasks}
            flow={flow}
            members={members}
            pendingTaskIds={pendingTaskIds}
            taskHref={taskHref}
            onStartTask={(task) => void runTask(task)}
            onAcceptTask={(task) => void acceptTask(task)}
            onCreateTask={() => setIsCreateOpen(true)}
            canCreateTask
          />
        )}
      </PageShell.Content>

      <CreateTaskDialog
        open={isCreateOpen}
        flow={flow}
        members={members}
        agents={agents}
        boardTasks={tasks}
        isSubmitting={create.isPending}
        errorMessage={create.error ? getErrorMessage(create.error, "") : undefined}
        onOpenChange={setIsCreateOpen}
        onSubmit={addTask}
      />
    </>
  );
}

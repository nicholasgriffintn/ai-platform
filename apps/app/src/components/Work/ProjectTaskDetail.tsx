import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { BackLink, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { TaskDetail } from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { useProjectTask, useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage } from "~/lib/errors";

import { useProjectTaskAgents } from "./useProjectTaskAgents";
import { useWorkData } from "./WorkDataContext";

export function ProjectTaskDetail({
  workspaceId,
  projectId,
  taskId,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const { projectQuery, workspaceQuery } = useWorkData();
  const agents = useProjectTaskAgents(projectQuery.data?.capabilities);
  const { tasks, flow, isLoading, error, start, accept, update, remove } =
    useProjectTasks(projectId);
  const detailQuery = useProjectTask(projectId, taskId);
  const task = detailQuery.data?.task ?? tasks.find((candidate) => candidate.id === taskId);
  const goal = detailQuery.data?.goal ?? null;
  const basePath = `/work/${workspaceId}/projects/${projectId}`;

  if (isLoading || detailQuery.isLoading) {
    return (
      <PageShell.Content className="max-w-6xl">
        <p className="text-sm text-zinc-500">Loading the task…</p>
      </PageShell.Content>
    );
  }

  if (error || detailQuery.error || !task) {
    return (
      <PageShell.Content className="max-w-6xl">
        <BackLink href={`${basePath}/tasks`} label="Back to tasks" />
        <PageShell.Header title="Task" />
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error?.message ?? detailQuery.error?.message ?? "This task is no longer available."}
        </p>
      </PageShell.Content>
    );
  }

  const isBusy = start.isPending || accept.isPending || update.isPending || remove.isPending;
  const run = async () => {
    try {
      await start.mutateAsync(task.id);
      toast.success("Task queued");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to run this task"));
    }
  };

  const setStatus = async (status: ProjectTask["status"], message: string) => {
    try {
      await update.mutateAsync({ taskId: task.id, input: { status } });
      toast.success(message);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to update this task"));
    }
  };

  const acceptTask = async () => {
    try {
      const { task: accepted } = await accept.mutateAsync(task.id);

      toast.success(accepted.status === "done" ? "Task accepted" : "Moved to the next stage");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to accept this task"));
    }
  };

  const deleteTask = async () => {
    try {
      await remove.mutateAsync(task.id);
      toast.success("Task deleted");
      void navigate(`${basePath}/tasks`, { replace: true });
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to delete this task"));
    }
  };

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <BackLink href={`${basePath}/tasks`} label="Back to tasks" />
        <PageShell.Header title={task.objective} />
        <TaskDetail
          task={task}
          goal={goal}
          flow={flow}
          members={workspaceQuery.data?.members ?? []}
          agents={agents}
          blockedBy={tasks.filter((candidate) => task.dependsOnTaskIds.includes(candidate.id))}
          conversationHref={
            task.conversationId ? `${basePath}/chat?completion_id=${task.conversationId}` : null
          }
          taskHref={(candidate) => `${basePath}/tasks/${candidate.id}`}
          isBusy={isBusy}
          onRun={() => void run()}
          onAccept={() => void acceptTask()}
          onCancel={() => void setStatus("cancelled", "Task cancelled")}
          onReopen={() => void setStatus("backlog", "Task reopened")}
          onDelete={() => setIsDeleteOpen(true)}
          renderProgressSummary={(summary) => (
            <MemoizedMarkdown className="max-w-none text-sm leading-6">{summary}</MemoizedMarkdown>
          )}
        />
      </PageShell.Content>

      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete task?"
        description="This removes the task from the project. Its conversation remains in project history. This cannot be undone."
        confirmText="Delete task"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={deleteTask}
      />
    </>
  );
}

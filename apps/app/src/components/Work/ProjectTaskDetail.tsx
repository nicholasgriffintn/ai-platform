import { BackLink } from "@ngriffin_uk/polychat-component-ui";
import { TaskDetail } from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { useGoal } from "~/hooks/useGoal";
import { useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage } from "~/lib/errors";

import { useWorkData } from "./WorkContext";

export function ProjectTaskDetail({
  workspaceId,
  projectId,
  taskId,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
}) {
  const navigate = useNavigate();
  const { workspaceQuery } = useWorkData();
  const { tasks, flow, isLoading, error, start, accept, update, remove } =
    useProjectTasks(projectId);
  const task = tasks.find((candidate) => candidate.id === taskId);
  const { goal } = useGoal(task?.conversationId ?? undefined, {
    refetchInterval: task?.status === "running" ? 5000 : undefined,
  });
  const basePath = `/work/${workspaceId}/projects/${projectId}`;

  if (isLoading) {
    return (
      <PageShell.Content className="max-w-3xl">
        <p className="text-sm text-zinc-500">Loading the task…</p>
      </PageShell.Content>
    );
  }

  if (error || !task) {
    return (
      <PageShell.Content className="max-w-3xl">
        <BackLink href={`${basePath}/tasks`} label="Back to the board" />
        <PageShell.Header title="Task" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error?.message ?? "This task is no longer on the board."}
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

  return (
    <PageShell.Content className="max-w-3xl">
      <BackLink href={`${basePath}/tasks`} label="Back to the board" />
      <PageShell.Header title={task.objective} />
      <TaskDetail
        task={task}
        goal={goal}
        flow={flow}
        members={workspaceQuery.data?.members ?? []}
        blockedBy={tasks.filter((candidate) => task.dependsOnTaskIds.includes(candidate.id))}
        conversationHref={
          task.conversationId ? `${basePath}/chat?completion_id=${task.conversationId}` : null
        }
        taskHref={(candidate) => `${basePath}/tasks/${candidate.id}`}
        isBusy={isBusy}
        onRun={() => void run()}
        onAccept={async () => {
          try {
            const { task: accepted } = await accept.mutateAsync(task.id);

            toast.success(accepted.status === "done" ? "Task accepted" : "Moved to the next stage");
          } catch (mutationError) {
            toast.error(getErrorMessage(mutationError, "Unable to accept this task"));
          }
        }}
        onCancel={() => void setStatus("cancelled", "Task cancelled")}
        onReopen={() => void setStatus("backlog", "Task reopened")}
        onDelete={async () => {
          try {
            await remove.mutateAsync(task.id);
            toast.success("Task deleted");
            void navigate(`${basePath}/tasks`, { replace: true });
          } catch (mutationError) {
            toast.error(getErrorMessage(mutationError, "Unable to delete this task"));
          }
        }}
      />
    </PageShell.Content>
  );
}

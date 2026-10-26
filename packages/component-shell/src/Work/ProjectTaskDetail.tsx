import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { BackLink, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { TaskDetail, type TaskWorkProps } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useProjectTask,
  useProjectTasks,
  useRaiseCase,
  useStandupDraft,
  useWorkTaskActions,
  getProjectConversationPath,
  getProjectFilesPath,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask, UpdateProjectTaskInput } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { ProjectReviewPublicationControl } from "./ProjectReviewPublicationControl.js";
import { useWorkDirectory } from "./useWorkDirectory.js";

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
  const {
    tasks,
    flow,
    isLoading,
    error,
    start,
    accept,
    update,
    remove,
    create: createSubTask,
  } = useProjectTasks(projectId);
  const detailQuery = useProjectTask(projectId, taskId);
  const task = detailQuery.data?.task ?? tasks.find((candidate) => candidate.id === taskId);
  const goal = detailQuery.data?.goal ?? null;
  const activity = detailQuery.data?.activity;
  const plan = detailQuery.data?.plan;
  const basePath = `/work/${workspaceId}/projects/${projectId}`;
  const currentUserId = useChatStore((state) => state.user?.id ?? null);
  const { directory } = useWorkDirectory(workspaceId);
  const actions = useWorkTaskActions(projectId, taskId);
  const raiseCase = useRaiseCase(projectId);
  const standup = task?.details.standup;
  const standupDraft = useStandupDraft(
    projectId,
    taskId,
    Boolean(standup && !standup.summary && currentUserId),
  );

  if (isLoading || detailQuery.isLoading) {
    return (
      <PageShell.Content className="max-w-6xl">
        <p className="text-sm text-muted-foreground">Loading the task…</p>
      </PageShell.Content>
    );
  }

  if (error || detailQuery.error || !task || !activity || !plan) {
    return (
      <PageShell.Content className="max-w-6xl">
        <BackLink href={`${basePath}/tasks`} label="Back to tasks" />
        <PageShell.Header title="Task" />
        <p role="alert" className="text-sm text-failure">
          {error?.message ?? detailQuery.error?.message ?? "This task is no longer available."}
        </p>
      </PageShell.Content>
    );
  }

  const isBusy =
    start.isPending ||
    accept.isPending ||
    update.isPending ||
    remove.isPending ||
    actions.assign.isPending ||
    actions.answerStandup.isPending;
  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "That did not work"));
    }
  };

  const patch = (input: UpdateProjectTaskInput, message: string) =>
    runAction(() => update.mutateAsync({ taskId: task.id, input }), message);

  const work: TaskWorkProps = {
    directory,
    subTasks: detailQuery.data?.children ?? [],
    links: detailQuery.data?.links ?? [],
    thread: detailQuery.data?.thread ?? [],
    currentUserId,
    standupDraft: standupDraft.data ?? null,
    onAssign: (owner) =>
      owner
        ? void runAction(() => actions.assign.mutateAsync(owner), "Task handed over")
        : void patch({ owner: null }, "Owner cleared"),
    onSetReviewer: (reviewer) =>
      void runAction(
        () => actions.requestReview.mutateAsync({ reviewer, note: null }),
        "Sent for review",
      ),
    onSetPriority: (priority) => void patch({ priority }, "Priority updated"),
    onSetDueAt: (dueAt) => void patch({ dueAt }, "Due date updated"),
    onComment: (body) => actions.comment.mutateAsync(body),
    onAddSubTask: (objective) =>
      runAction(
        () => createSubTask.mutateAsync({ objective, parentTaskId: task.id }),
        "Sub-task added",
      ),
    onRaiseCase: (title) =>
      runAction(
        () =>
          raiseCase.mutateAsync({
            title,
            description: null,
            priority: "none",
            raisedFromTaskId: task.id,
          }),
        "Case raised and sent to Triage",
      ),
    onEscalate: (reason) => runAction(() => actions.escalate.mutateAsync(reason), "Escalated"),
    onResolveCase: (resolution) =>
      void runAction(() => actions.resolve.mutateAsync(resolution), "Case resolved"),
    onSendCaseReply: (body) => runAction(() => actions.sendReply.mutateAsync(body), "Reply sent"),
    onSendAgain: () =>
      void runAction(() => actions.sendAgain.mutateAsync(), "Sent to the queue again"),
    onClearEscalation: () =>
      void runAction(() => actions.clearEscalation.mutateAsync(), "Escalation handled"),
    onAnswerStandup: (input) =>
      void runAction(() => actions.answerStandup.mutateAsync(input), "Answers sent"),
    onUnlink: (linkId) => void runAction(() => actions.unlink.mutateAsync(linkId), "Link removed"),
  };

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
        <PageShell.Header title={task.key ?? "Task"} />
        {task.executionProfile === "diff_review" ? (
          <ProjectReviewPublicationControl key={task.id} projectId={projectId} task={task} />
        ) : null}
        <TaskDetail
          task={task}
          goal={goal}
          activity={activity}
          plan={plan}
          flow={flow}
          blockedBy={tasks.filter((candidate) => task.dependsOnTaskIds.includes(candidate.id))}
          conversationHref={
            task.conversationId
              ? getProjectConversationPath(workspaceId, projectId, task.conversationId)
              : null
          }
          originConversationHref={
            task.originConversationId
              ? getProjectConversationPath(workspaceId, projectId, task.originConversationId)
              : null
          }
          taskHref={(candidate) =>
            `/work/${workspaceId}/projects/${candidate.projectId}/tasks/${candidate.id}`
          }
          runHref={(conversationId, runId) =>
            `${getProjectConversationPath(workspaceId, projectId, conversationId)}?run_id=${encodeURIComponent(runId)}`
          }
          outputHref={(outputId) =>
            getProjectFilesPath(workspaceId, projectId, "made", encodeURIComponent(outputId))
          }
          isBusy={isBusy}
          work={work}
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

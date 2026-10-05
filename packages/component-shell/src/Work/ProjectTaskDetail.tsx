import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { BackLink, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { TaskDetail, TaskFlowHistory } from "@ngriffin_uk/polychat-component-workspaces";
import {
  useProjectTask,
  useProjectFlowHistory,
  getProjectConversationPath,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "../Shell/PageShell.js";
import { useProjectTaskDetailActions } from "./useProjectTaskDetailActions.js";
import { useProjectTaskTeammates } from "./useProjectTaskTeammates.js";
import { useWorkData } from "./WorkDataContext.js";

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
  const teammates = useProjectTaskTeammates(projectQuery.data?.capabilities);
  const basePath = `/work/${workspaceId}/projects/${projectId}`;
  const actions = useProjectTaskDetailActions(projectId, taskId, () => {
    void navigate(`${basePath}/tasks`, { replace: true });
  });
  const { tasks, isLoading, error, remove } = actions;
  const history = useProjectFlowHistory(projectId, taskId);
  const detailQuery = useProjectTask(projectId, taskId);
  const task = detailQuery.data?.task ?? tasks.find((candidate) => candidate.id === taskId);
  const goal = detailQuery.data?.goal ?? null;
  const activity = detailQuery.data?.activity;
  const plan = detailQuery.data?.plan;

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

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <BackLink href={`${basePath}/tasks`} label="Back to tasks" />
        <PageShell.Header title={task.objective} />
        <TaskDetail
          task={task}
          goal={goal}
          activity={activity}
          plan={plan}
          members={workspaceQuery.data?.members ?? []}
          teammates={teammates}
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
          taskHref={(candidate) => `${basePath}/tasks/${candidate.id}`}
          runHref={(conversationId, runId) =>
            `${basePath}/chat?completion_id=${encodeURIComponent(conversationId)}&run_id=${encodeURIComponent(runId)}`
          }
          outputHref={(outputId) => `${basePath}/outputs/${encodeURIComponent(outputId)}`}
          isBusy={actions.isBusy}
          onRun={() => void actions.run()}
          flowWait={detailQuery.data?.flowWait ?? null}
          canRespondToFlowWait={detailQuery.data?.canRespondToFlowWait ?? false}
          waitError={actions.waitError}
          onRespondToWait={actions.respond}
          onCancel={() => void actions.cancel()}
          onDelete={() => setIsDeleteOpen(true)}
          renderProgressSummary={(summary) => (
            <MemoizedMarkdown className="max-w-none text-sm leading-6">{summary}</MemoizedMarkdown>
          )}
        />
        <div className="mt-8">
          <TaskFlowHistory
            task={task}
            events={history.data?.pages.flatMap((page) => page.events) ?? []}
            hasMore={history.hasNextPage}
            isLoading={history.isFetching}
            errorMessage={history.error?.message}
            onLoadMore={() => {
              void history.fetchNextPage();
            }}
          />
        </div>
      </PageShell.Content>

      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete task?"
        description="This removes the task from the project. Its conversation remains in project history. This cannot be undone."
        confirmText="Delete task"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={actions.deleteTask}
      />
    </>
  );
}

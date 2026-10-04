import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  CreateTaskDialog,
  FlowEditorDialog,
  TaskBoard,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  useCapabilityCatalog,
  getTeammateEditorPath,
  getProjectSurface,
  getProjectConversationPath,
  NEW_TEAMMATE_ID,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Plus } from "lucide-react";
import { useState } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { useQueryDialog } from "../utils/useQueryDialog.js";
import { ProjectHomeHeader } from "./ProjectHomeHeader.js";
import { ProjectTaskIntegrationsControl } from "./ProjectTaskIntegrationsControl.js";
import { useProjectTaskBoardActions } from "./useProjectTaskBoardActions.js";
import { projectTaskSkills, useProjectTaskTeammates } from "./useProjectTaskTeammates.js";
import { useWorkData } from "./WorkDataContext.js";

export function ProjectTaskBoard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useQueryDialog("new");
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const { projectQuery, workspaceQuery } = useWorkData();
  const teammates = useProjectTaskTeammates(projectQuery.data?.capabilities);
  const capabilityCatalog = useCapabilityCatalog(projectId);
  const skills = projectTaskSkills(projectQuery.data?.capabilities, capabilityCatalog.data?.skills);
  const {
    tasks,
    flow,
    isLoading,
    error,
    create,
    start,
    accept,
    saveFlow,
    runTask,
    acceptTask,
    addTask,
    saveProjectFlow,
  } = useProjectTaskBoardActions({
    projectId,
    onTaskCreated: () => setIsCreateOpen(false),
    onFlowSaved: () => setIsFlowOpen(false),
  });

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view project tasks"
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
  const canManageFlow =
    workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
  const basePath = `/work/${workspaceId}/projects/${projectId}`;

  const taskHref = (task: ProjectTask) => `${basePath}/tasks/${task.id}`;
  const conversationHref = (task: ProjectTask) =>
    task.conversationId
      ? getProjectConversationPath(workspaceId, projectId, task.conversationId)
      : null;

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <ProjectHomeHeader
          workspaceId={workspaceId}
          projectId={projectId}
          actions={
            <Button
              variant="primary"
              size="sm"
              collapseLabel
              className="shrink-0"
              aria-label="Add a task"
              title="Add a task"
              icon={<Plus size={16} />}
              onClick={() => setIsCreateOpen(true)}
            >
              Add a task
            </Button>
          }
        />
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Route outcomes through specialist teammates, watch live work, and step in only when a
          stage needs review or approval.
        </p>

        <ProjectTaskIntegrationsControl
          key={projectId}
          projectId={projectId}
          taskBasePath={`${basePath}/tasks`}
          canManage={canManageFlow}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading project tasks…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        ) : (
          <TaskBoard
            tasks={tasks}
            flow={flow}
            members={members}
            teammates={teammates}
            pendingTaskIds={pendingTaskIds}
            taskHref={taskHref}
            conversationHref={conversationHref}
            onStartTask={(task) => void runTask(task)}
            onAcceptTask={(task) => void acceptTask(task)}
            onCreateTask={() => setIsCreateOpen(true)}
            onConfigureFlow={() => setIsFlowOpen(true)}
            canCreateTask
            canManageFlow={canManageFlow}
          />
        )}
      </PageShell.Content>

      <CreateTaskDialog
        open={isCreateOpen}
        flow={flow}
        members={members}
        teammates={teammates}
        boardTasks={tasks}
        isSubmitting={create.isPending || start.isPending}
        errorMessage={create.error ? getErrorMessage(create.error, "") : undefined}
        onOpenChange={setIsCreateOpen}
        onSubmit={addTask}
      />

      <FlowEditorDialog
        open={isFlowOpen}
        flow={flow}
        teammates={teammates}
        skills={skills}
        capabilitiesHref={`${basePath}/teammates`}
        createTeammateHref={getTeammateEditorPath(
          getProjectSurface(workspaceId, projectId),
          NEW_TEAMMATE_ID,
        )}
        isSaving={saveFlow.isPending}
        errorMessage={saveFlow.error ? getErrorMessage(saveFlow.error, "") : undefined}
        onOpenChange={setIsFlowOpen}
        onSave={saveProjectFlow}
      />
    </>
  );
}

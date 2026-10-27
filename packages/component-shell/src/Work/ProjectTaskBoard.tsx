import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  CreateTaskDialog,
  ProjectHomeActions,
  TaskViewTabs,
  WorkTaskBoard,
  WorkTaskList,
  WorkTaskTimeline,
  WorkTaskTree,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  canManageWorkspace,
  getProjectBasePath,
  getProjectTaskPath,
  useArchiveProject,
  useCapabilityCatalog,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { useQueryDialog } from "../utils/useQueryDialog.js";
import { AddTaskMenu } from "./AddTaskMenu.js";
import { ImportProjectIssueDialog } from "./ImportProjectIssueDialog.js";
import { ProjectHomeHeader } from "./ProjectHomeHeader.js";
import { useProjectTaskBoardActions } from "./useProjectTaskBoardActions.js";
import { useProjectTemplateSave } from "./useProjectTemplateSave.js";
import { useTaskViewParam } from "./useTaskViewParam.js";
import { useWorkDirectory } from "./useWorkDirectory.js";
import { useWorkData } from "./WorkDataContext.js";
import { WorkPageFailure } from "./WorkPageFailure.js";
import { WorkTaskComposer } from "./WorkTaskComposer.js";

export function ProjectTaskBoard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [view, setView] = useTaskViewParam();
  const [isCreateOpen, setIsCreateOpen] = useQueryDialog("new");
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const navigate = useNavigate();
  const archiveProject = useArchiveProject();
  const { projectQuery, workspaceQuery } = useWorkData();
  const { directory, team, leadTeammateId } = useWorkDirectory(workspaceId);
  const saveTemplate = useProjectTemplateSave(workspaceId, projectQuery.data ?? null);
  const capabilityCatalog = useCapabilityCatalog(projectId);
  const teammates = capabilityCatalog.data?.teammates ?? [];
  const { tasks, flow, isLoading, error, create, start, addTask } = useProjectTaskBoardActions({
    projectId,
    onTaskCreated: () => setIsCreateOpen(false),
  });

  if (isAuthenticationError(error)) {
    return (
      <WorkPageFailure
        title="Tasks"
        error={error}
        fallbackMessage="Tasks could not be loaded"
        signInTitle="Sign in to view project tasks"
        signInMessage="Sign in to see the tasks this project is working through."
      />
    );
  }

  const members = [...directory.people];
  const stageOf = (task: ProjectTask) =>
    (task.flowSnapshot ?? flow)?.stages.find((stage) => stage.id === task.stageId)?.name ?? null;
  const canManage = Boolean(workspaceQuery.data && canManageWorkspace(workspaceQuery.data));
  const basePath = getProjectBasePath(workspaceId, projectId);
  const taskHref = (task: Pick<ProjectTask, "id">) =>
    getProjectTaskPath(workspaceId, projectId, task.id);
  const visibleTasks = tasks.filter((task) => task.kind !== "standup" || task.status !== "done");
  const workTasks = visibleTasks.filter((task) => task.kind !== "case");
  const cases = visibleTasks.filter((task) => task.kind === "case");
  const lead = team.find(
    (teammate) =>
      teammate.teammateId === leadTeammateId &&
      teammate.status === "active" &&
      teammate.projectIds.includes(projectId),
  );
  const quickAdd = async (text: string) => {
    try {
      const { task } = await create.mutateAsync({
        objective: text,
        ...(lead ? { owner: { type: "teammate" as const, id: lead.teammateId } } : {}),
      });

      if (lead) {
        await start.mutateAsync(task.id);
      }

      toast.success(lead ? `Handed to ${lead.name}` : "Added to the backlog");

      return true;
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError, "Unable to add that task"));

      return false;
    }
  };

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <ProjectHomeHeader
          workspaceId={workspaceId}
          projectId={projectId}
          actions={
            <div className="flex items-center gap-1">
              <ProjectHomeActions
                canManage={canManage}
                isSavingTemplate={saveTemplate.isSaving}
                onArchive={() => setIsArchiveOpen(true)}
                onSaveTemplate={() => void saveTemplate.save()}
              />
              <AddTaskMenu
                onAddTask={() => setIsCreateOpen(true)}
                onImportIssue={() => setIsImportOpen(true)}
              />
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <TaskViewTabs
            view={view}
            triageCount={cases.filter((task) => task.status === "backlog").length}
            onChange={setView}
          />
        </div>

        <div className="mb-4">
          <WorkTaskComposer
            placeholder={
              lead
                ? `Ask for something and ${lead.name} will route it…`
                : "Describe a task and press Enter…"
            }
            isSubmitting={create.isPending}
            onSubmit={quickAdd}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading project tasks…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        ) : view === "board" ? (
          <WorkTaskBoard
            tasks={workTasks}
            directory={directory}
            taskHref={taskHref}
            stageOf={stageOf}
            emptyMessage="No tasks yet. Ask for something above to get started."
          />
        ) : view === "tree" ? (
          <WorkTaskTree
            tasks={workTasks}
            directory={directory}
            taskHref={taskHref}
            stageOf={stageOf}
          />
        ) : view === "timeline" ? (
          <WorkTaskTimeline tasks={workTasks} directory={directory} taskHref={taskHref} />
        ) : view === "triage" ? (
          <WorkTaskList
            tasks={cases}
            directory={directory}
            taskHref={taskHref}
            emptyMessage="No cases. Problems raised by people, teammates or outside requests land here."
          />
        ) : (
          <WorkTaskList
            tasks={workTasks}
            directory={directory}
            taskHref={taskHref}
            stageOf={stageOf}
            emptyMessage="No tasks yet. Ask for something above to get started."
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

      {isImportOpen ? (
        <ImportProjectIssueDialog
          projectId={projectId}
          taskBasePath={`${basePath}/tasks`}
          onClose={() => setIsImportOpen(false)}
          onImported={(taskId) => {
            setIsImportOpen(false);
            void navigate(`${basePath}/tasks/${taskId}`);
          }}
        />
      ) : null}

      <ConfirmationDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Archive project"
        description={`Archive ${projectQuery.data?.name ?? "this project"}. Its tasks will no longer appear in this workspace.`}
        confirmText="Archive project"
        variant="destructive"
        isLoading={archiveProject.isPending}
        onConfirm={async () => {
          await archiveProject.mutateAsync({ workspaceId, projectId });
          void navigate(`/work/${workspaceId}`, { replace: true });
        }}
      >
        {archiveProject.error && (
          <p role="alert" className="text-sm text-failure">
            {archiveProject.error.message}
          </p>
        )}
      </ConfirmationDialog>
    </>
  );
}

import { PageShell, SignInEmptyState } from "@ngriffin_uk/polychat-component-shell";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  CreateTaskDialog,
  FlowEditorDialog,
  TaskBoard,
  type CreateTaskInput,
  type CreateTaskIntent,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  useCapabilityCatalog,
  useProjectTasks,
  getTeammateEditorPath,
  getProjectSurface,
  getProjectConversationPath,
  getErrorMessage,
  isAuthenticationError,
  NEW_TEAMMATE_ID,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectHomeHeader } from "./ProjectHomeHeader";
import { projectTaskSkills, useProjectTaskTeammates } from "./useProjectTaskTeammates";
import { useWorkData } from "./WorkDataContext";

export function ProjectTaskBoard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const { projectQuery, workspaceQuery } = useWorkData();
  const teammates = useProjectTaskTeammates(projectQuery.data?.capabilities);
  const capabilityCatalog = useCapabilityCatalog(projectId);
  const skills = projectTaskSkills(projectQuery.data?.capabilities, capabilityCatalog.data?.skills);
  const { tasks, flow, isLoading, error, create, start, accept, saveFlow } =
    useProjectTasks(projectId);

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
        onSave={async (nextFlow) => {
          try {
            await saveFlow.mutateAsync(nextFlow);
            setIsFlowOpen(false);
            toast.success("Teammate pipeline saved");
          } catch (mutationError) {
            toast.error(getErrorMessage(mutationError, "Unable to save the teammate pipeline"));
          }
        }}
      />
    </>
  );
}

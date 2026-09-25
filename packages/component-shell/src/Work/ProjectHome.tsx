import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectBriefPreview,
  ProjectConversationList,
  ProjectHomeActions,
  ProjectOverviewSkeleton,
  ProjectTasksSummary,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  useArchiveProject,
  useProjectTasks,
  getProjectBasePath,
  getProjectConversationPath,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { ProjectConversationStarter } from "./ProjectConversationStarter.js";
import { ProjectHomeHeader } from "./ProjectHomeHeader.js";
import { useProjectTemplateSave } from "./useProjectTemplateSave.js";
import { useWorkData } from "./WorkDataContext.js";

export function ProjectHome({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const archiveProject = useArchiveProject();
  const navigate = useNavigate();
  const { projectQuery, workspaceQuery } = useWorkData();
  const { data: project, isLoading, error } = projectQuery;
  const { data: workspace } = workspaceQuery;
  const saveTemplate = useProjectTemplateSave(workspaceId, project ?? null);
  const projectTasks = useProjectTasks(projectId);

  if (isLoading) {
    return <ProjectOverviewSkeleton />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view this project"
        message="Sign in to access this project and its conversations."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (error || !project) {
    return (
      <div role="alert" className="p-10 text-sm text-failure">
        {error?.message ?? "Project not found"}
      </div>
    );
  }

  const basePath = getProjectBasePath(workspaceId, projectId);
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  const conversations = project.conversations.filter(
    (conversation) => conversation.type === "chat",
  );

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <ProjectHomeHeader
          workspaceId={workspaceId}
          projectId={projectId}
          actions={
            <ProjectHomeActions
              canManage={canManage}
              settingsPath={`${basePath}/settings`}
              conversationPath={`${basePath}/chat`}
              isSavingTemplate={saveTemplate.isSaving}
              onArchive={() => setIsArchiveOpen(true)}
              onSaveTemplate={() => void saveTemplate.save()}
            />
          }
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <ProjectConversationStarter workspaceId={workspaceId} projectId={projectId} />
            <ProjectConversationList
              conversationCount={conversations.length}
              conversations={conversations.map((conversation) => ({
                id: conversation.id,
                title: conversation.title,
                messageCount: conversation.messageCount,
                createdByName: conversation.createdBy.name,
                href: getProjectConversationPath(workspaceId, projectId, conversation.id),
              }))}
            />
          </div>
          <aside aria-label="Project overview" className="min-w-0 space-y-8">
            <ProjectTasksSummary
              tasks={projectTasks.tasks}
              isLoading={projectTasks.isLoading}
              errorMessage={
                projectTasks.error
                  ? getErrorMessage(projectTasks.error, "Tasks could not be loaded")
                  : undefined
              }
              boardHref={`${basePath}/tasks`}
              taskHref={(task) => `${basePath}/tasks/${task.id}`}
              onCreateTask={() => void navigate(`${basePath}/tasks?new=1`)}
            />
            <ProjectBriefPreview
              instructions={project.instructions}
              settingsHref={`${basePath}/settings`}
              canManage={canManage}
            />
          </aside>
        </div>
      </PageShell.Content>
      <ConfirmationDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Archive project"
        description={`Archive ${project.name}. Its conversations will no longer appear in this workspace.`}
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

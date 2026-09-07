import { PageShell, SignInEmptyState } from "@ngriffin_uk/polychat-component-shell";
import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectConversationList,
  ProjectHomeActions,
  ProjectOverviewSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  useArchiveProject,
  getProjectBasePath,
  getProjectConversationPath,
  isAuthenticationError,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ProjectConversationStarter } from "./ProjectConversationStarter";
import { ProjectHomeHeader } from "./ProjectHomeHeader";
import { useProjectTemplateSave } from "./useProjectTemplateSave";
import { useWorkData } from "./WorkDataContext";

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

        <div className="space-y-6">
          <ProjectConversationStarter workspaceId={workspaceId} projectId={projectId} />
          <ProjectConversationList
            conversationCount={conversations.length}
            newConversationHref={`${basePath}/chat`}
            conversations={conversations.map((conversation) => ({
              id: conversation.id,
              title: conversation.title,
              messageCount: conversation.messageCount,
              createdByName: conversation.createdBy.name,
              href: getProjectConversationPath(workspaceId, projectId, conversation.id),
            }))}
          />
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

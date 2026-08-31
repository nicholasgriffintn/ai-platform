import { Card, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectCapabilitiesCard,
  ProjectConversationList,
  ProjectOverviewActions,
  ProjectOverviewSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useTemplateMutations } from "~/hooks/useGovernance";
import { useArchiveProject } from "~/hooks/useWorkspaces";
import { getErrorMessage, isAuthenticationError } from "~/lib/errors";

import { ProjectBriefCard } from "./ProjectBriefCard";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard";
import { ProjectConversationStarter } from "./ProjectConversationStarter";
import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard";
import { ProjectSchedulesCard } from "./ProjectSchedulesCard";
import { ProjectTasksCard } from "./ProjectTasksCard";
import { useWorkData } from "./WorkDataContext";

export function ProjectOverview({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const archiveProject = useArchiveProject();
  const templates = useTemplateMutations(workspaceId);
  const navigate = useNavigate();
  const { projectQuery, workspaceQuery } = useWorkData();
  const { data: project, isLoading, error } = projectQuery;
  const { data: workspace } = workspaceQuery;

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
      <div role="alert" className="p-10 text-sm text-red-700">
        {error?.message ?? "Project not found"}
      </div>
    );
  }

  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  const capabilitiesPath = `/work/${workspaceId}/projects/${projectId}/library`;
  const conversationPath = `/work/${workspaceId}/projects/${projectId}/chat`;
  const tasksPath = `/work/${workspaceId}/projects/${projectId}/tasks`;
  const recentChats = project.conversations
    .filter((conversation) => conversation.type === "chat")
    .slice(0, 5);
  const handleSaveTemplate = async () => {
    try {
      await templates.create.mutateAsync({
        workspaceId,
        kind: "project",
        name: project.name,
        description: project.description,
        configuration: {
          project: {
            name: project.name,
            description: project.description,
            instructions: project.instructions,
            colour: project.colour,
            codingEnvironment: project.codingEnvironment,
          },
          capabilities: project.capabilities.map((capability) => ({
            kind: capability.kind,
            capabilityId: capability.capabilityId,
            configuration: capability.configuration,
          })),
        },
        status: "active",
      });
      toast.success("Project template saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save project template"));
    }
  };

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header
          title={project.name}
          actionContent={
            <ProjectOverviewActions
              canManage={canManage}
              capabilitiesPath={capabilitiesPath}
              conversationPath={conversationPath}
              tasksPath={tasksPath}
              isSavingTemplate={templates.create.isPending}
              onArchive={() => setIsArchiveOpen(true)}
              onSaveTemplate={() => void handleSaveTemplate()}
            />
          }
        />
        <p className="mb-6 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          {project.description || "No project description"}
        </p>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="min-w-0 space-y-6">
            <ProjectConversationStarter workspaceId={workspaceId} projectId={projectId} />
            <ProjectTasksCard workspaceId={workspaceId} projectId={projectId} />
            <ProjectConversationList
              conversationCount={recentChats.length}
              newConversationHref={`/work/${workspaceId}/projects/${projectId}/chat`}
              conversations={recentChats.map((conversation) => ({
                id: conversation.id,
                title: conversation.title,
                messageCount: conversation.messageCount,
                createdByName: conversation.createdBy.name,
                href: `/work/${workspaceId}/projects/${projectId}/chat?completion_id=${conversation.id}`,
              }))}
            />
          </section>
          <aside>
            <Card className="gap-0 overflow-hidden py-0 shadow-none">
              <ProjectBriefCard
                embedded
                canManage={canManage}
                instructions={project.instructions}
                projectId={projectId}
              />
              <ProjectKnowledgeCard
                embedded
                workspaceId={workspaceId}
                projectId={projectId}
                canManage={canManage}
              />
              <ProjectSchedulesCard
                embedded
                workspaceId={workspaceId}
                projectId={projectId}
                capabilities={project.capabilities}
                members={workspace?.members ?? []}
              />
              <ProjectCodingEnvironmentCard embedded canManage={canManage} project={project} />
              <ProjectCapabilitiesCard
                embedded
                capabilities={project.capabilities}
                capabilityCount={project.capabilityCount}
              />
            </Card>
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
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {archiveProject.error.message}
          </p>
        )}
      </ConfirmationDialog>
    </>
  );
}

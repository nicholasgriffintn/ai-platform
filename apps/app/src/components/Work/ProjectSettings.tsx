import { ButtonLink, Card } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectCapabilitiesCard,
  ProjectOverviewSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import { ChevronLeft } from "lucide-react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { getProjectBasePath } from "~/lib/conversation-route";
import { isAuthenticationError } from "~/lib/errors";

import { ProjectBriefCard } from "./ProjectBriefCard";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard";
import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard";
import { ProjectRoutingCard } from "./ProjectRoutingCard";
import { ProjectSchedulesCard } from "./ProjectSchedulesCard";
import { useWorkData } from "./WorkDataContext";

export function ProjectSettings({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
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
        message="Sign in to change how this project runs."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (error || !project) {
    return (
      <div role="alert" className="text-failure p-10 text-sm">
        {error?.message ?? "Project not found"}
      </div>
    );
  }

  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  return (
    <PageShell.Content className="max-w-4xl">
      <PageShell.Header
        title={`${project.name} settings`}
        actionContent={
          <ButtonLink
            variant="ghost"
            size="sm"
            href={getProjectBasePath(workspaceId, projectId)}
            icon={<ChevronLeft size={16} />}
          >
            Back to project
          </ButtonLink>
        }
      />
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        How this project briefs its teammates, which model tier it runs on, what it knows, and what
        runs on a schedule.
      </p>

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <ProjectBriefCard
          embedded
          canManage={canManage}
          instructions={project.instructions}
          projectId={projectId}
        />
        <ProjectRoutingCard canManage={canManage} project={project} />
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
    </PageShell.Content>
  );
}

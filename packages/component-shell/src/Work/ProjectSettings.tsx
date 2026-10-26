import { Card } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectTeammatesCard,
  ProjectOverviewSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";

import { ChannelConnections } from "../Channels/ChannelConnections.js";
import { PageShell } from "../Shell/PageShell.js";
import { ProjectBriefCard } from "./ProjectBriefCard.js";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard.js";
import { ProjectHomeTabs } from "./ProjectHomeTabs.js";
import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard.js";
import { ProjectRoutingCard } from "./ProjectRoutingCard.js";
import { ProjectSchedulesCard } from "./ProjectSchedulesCard.js";
import { ProjectStandupCard } from "./ProjectStandupCard.js";
import { useWorkData } from "./WorkDataContext.js";
import { WorkPageFailure } from "./WorkPageFailure.js";

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

  if (error || !project) {
    return (
      <WorkPageFailure
        title="Project settings"
        error={error}
        fallbackMessage="Project not found"
        signInTitle="Sign in to view this project"
        signInMessage="Sign in to change how this project runs."
        className="max-w-4xl"
      />
    );
  }

  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  return (
    <PageShell.Content className="max-w-4xl">
      <PageShell.Header title={`${project.name} settings`} />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        How this project briefs its teammates, which model tier it runs on, what it knows, its
        standup, and what runs on a schedule.
      </p>
      <ProjectHomeTabs workspaceId={workspaceId} projectId={projectId} />

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
        <ProjectStandupCard projectId={projectId} canManage={canManage} />
        <ProjectCodingEnvironmentCard embedded canManage={canManage} project={project} />
        <ChannelConnections projectId={projectId} canManage={canManage} />
        <ProjectTeammatesCard
          embedded
          capabilityCount={project.capabilityCount}
          teammatesHref={`${getProjectBasePath(workspaceId, projectId)}/teammates`}
        />
      </Card>
    </PageShell.Content>
  );
}

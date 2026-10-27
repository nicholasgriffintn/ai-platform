import { Badge, ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { ProjectOverviewSkeleton } from "@ngriffin_uk/polychat-component-workspaces";
import { canManageWorkspace, getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { Plug } from "lucide-react";

import { ChannelConnections } from "../Channels/ChannelConnections.js";
import { PageShell } from "../Shell/PageShell.js";
import { AskLeadButton } from "./AskLeadButton.js";
import { ProjectBriefCard } from "./ProjectBriefCard.js";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard.js";
import { ProjectHomeHeader } from "./ProjectHomeHeader.js";
import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard.js";
import { ProjectPipelineCard } from "./ProjectPipelineCard.js";
import { ProjectReviewsRow } from "./ProjectReviewsRow.js";
import { ProjectRoutingCard } from "./ProjectRoutingCard.js";
import { ProjectSchedulesCard } from "./ProjectSchedulesCard.js";
import { ProjectStandupCard } from "./ProjectStandupCard.js";
import { ProjectTeamCard } from "./ProjectTeamCard.js";
import { SettingsFrame, SettingsSection } from "./SettingsSection.js";
import { useWorkDirectory } from "./useWorkDirectory.js";
import { useWorkData } from "./WorkDataContext.js";
import { WorkPageFailure } from "./WorkPageFailure.js";

const SECTIONS = [
  { id: "brief", label: "Brief" },
  { id: "pipeline", label: "Pipeline" },
  { id: "team", label: "Team" },
  { id: "model", label: "Model" },
  { id: "knowledge", label: "Knowledge" },
  { id: "routines", label: "Routines" },
  { id: "standup", label: "Standup" },
  { id: "channels", label: "Channels" },
  { id: "services", label: "Services" },
  { id: "engineering", label: "Engineering" },
] as const;

export function ProjectSettings({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { projectQuery, workspaceQuery } = useWorkData();
  const { leadTeammateId } = useWorkDirectory(workspaceId);
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
        className="max-w-6xl"
      />
    );
  }

  const canManage = Boolean(workspace && canManageWorkspace(workspace));
  const basePath = getProjectBasePath(workspaceId, projectId);
  const services = project.capabilities.filter((capability) => !capability.excluded);

  return (
    <PageShell.Content className="max-w-6xl">
      <ProjectHomeHeader workspaceId={workspaceId} projectId={projectId} />

      <div className="grid gap-10 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-4 space-y-0.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 text-muted-foreground no-underline hover:bg-selection/60 hover:text-foreground hover:!no-underline"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6 pb-16">
          <SettingsFrame id="brief">
            <ProjectBriefCard
              embedded
              canManage={canManage}
              instructions={project.instructions}
              projectId={projectId}
            />
          </SettingsFrame>

          <ProjectPipelineCard
            workspaceId={workspaceId}
            projectId={projectId}
            capabilities={project.capabilities}
            canManage={canManage}
          />

          <ProjectTeamCard
            workspaceId={workspaceId}
            projectId={projectId}
            projectName={project.name}
          />

          <SettingsFrame id="model">
            <ProjectRoutingCard canManage={canManage} project={project} />
          </SettingsFrame>

          <SettingsFrame id="knowledge">
            <ProjectKnowledgeCard
              embedded
              workspaceId={workspaceId}
              projectId={projectId}
              canManage={canManage}
            />
          </SettingsFrame>

          <SettingsFrame id="routines">
            <ProjectSchedulesCard
              embedded
              workspaceId={workspaceId}
              projectId={projectId}
              capabilities={project.capabilities}
              members={workspace?.members ?? []}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Describe what should happen and when; the lead sets it up and tells you what it
                chose.
              </p>
              <AskLeadButton
                workspaceId={workspaceId}
                projectId={projectId}
                leadTeammateId={leadTeammateId}
                label="Ask the lead to set one up"
                title="Set up a routine"
                question="What should happen, and when?"
                placeholder="Every Friday at 4pm, draft next week's menu from this week's sales"
                objective={(request) => `Set up a routine: ${request}`.slice(0, 200)}
                brief="Find the recipe that runs this work with discover_capabilities, then create the schedule for this project with create_automation. Say the schedule back in words in your update."
              />
            </div>
          </SettingsFrame>

          <SettingsFrame id="standup">
            <ProjectStandupCard projectId={projectId} canManage={canManage} />
          </SettingsFrame>

          <SettingsFrame id="channels">
            <ChannelConnections projectId={projectId} canManage={canManage} />
          </SettingsFrame>

          <SettingsSection
            id="services"
            icon={<Plug size={16} />}
            title="Services and skills"
            description="What teammates here may use: connected services, MCP servers and skills. The lead grants each project only what it needs."
            action={
              canManage ? (
                <ButtonLink
                  href={`${basePath}/plugins`}
                  size="sm"
                  variant="secondary"
                  className="no-underline hover:!no-underline"
                >
                  Manage
                </ButtonLink>
              ) : null
            }
          >
            {services.length ? (
              <ul className="flex flex-wrap gap-2">
                {services.map((capability) => (
                  <li key={capability.id}>
                    <Badge variant="muted">
                      {humaniseIdentifier(capability.capabilityId.split(":").at(-1) ?? "")}
                      <span className="text-muted-foreground/70">· {capability.kind}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing attached. Teammates use the workspace's connected services.
              </p>
            )}
          </SettingsSection>

          <SettingsFrame id="engineering">
            <ProjectCodingEnvironmentCard embedded canManage={canManage} project={project} />
            <ProjectReviewsRow projectId={projectId} canManage={canManage} />
          </SettingsFrame>
        </div>
      </div>
    </PageShell.Content>
  );
}

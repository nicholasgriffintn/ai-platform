import { SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { WorkSidebarNav } from "@ngriffin_uk/polychat-component-workspaces";
import {
  getPlacePaths,
  getProjectBasePath,
  useTaskAttention,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useLocation, useNavigate } from "react-router";

import { useInboxNeedsYou } from "../Attention/useInboxNeedsYou.js";
import { SidebarFooter } from "../Sidebar/SidebarFooter.js";
import { SidebarHeader } from "../Sidebar/SidebarHeader.js";
import { useSidebarPeekPanel } from "../Sidebar/SidebarPeekContext.js";
import { useWorkData } from "./WorkDataContext.js";

interface WorkSidebarProps {
  workspaceId?: string;
  projectId?: string;
}

export function WorkSidebar({ workspaceId, projectId }: WorkSidebarProps) {
  const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore();
  const { peeking, panelProps } = useSidebarPeekPanel();
  const { workspacesQuery, workspaceQuery } = useWorkData();
  const { data } = workspacesQuery;
  const { data: workspace } = workspaceQuery;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { items: attentionItems } = useTaskAttention();
  const inboxNeedsYou = useInboxNeedsYou();
  const workPlaces = getPlacePaths("work");
  const projectBasePath = getProjectBasePath(workspaceId ?? "", projectId ?? "");
  const projectAttentionCount = projectId
    ? attentionItems.filter((item) => item.projectId === projectId).length
    : 0;
  const isProjectTasksPath =
    pathname === projectBasePath || pathname.startsWith(`${projectBasePath}/tasks`);

  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      peeking={peeking}
      peekProps={panelProps}
      onClose={() => setSidebarVisible(false)}
      label="Workspace navigation"
      header={<SidebarHeader />}
      footer={<SidebarFooter />}
    >
      <WorkSidebarNav
        inboxHref={workPlaces.attention}
        inboxCount={inboxNeedsYou}
        workspacesHref={workPlaces.conversations}
        workspace={
          workspace
            ? {
                id: workspace.id,
                name: workspace.name,
                role: workspace.role,
                projectsHref: `/work/${workspace.id}`,
                initiativesHref: `/work/${workspace.id}/initiatives`,
                teamHref: `/work/${workspace.id}/team`,
                costsHref: `/work/${workspace.id}/costs`,
                activityHref: `/work/${workspace.id}/activity`,
                membersHref: `/work/${workspace.id}/members`,
                modelsHref: `/work/${workspace.id}/models`,
                projects: workspace.projects.map((item) => ({
                  id: item.id,
                  name: item.name,
                  colour: item.colour,
                  prefix: item.taskPrefix,
                  href: `/work/${workspace.id}/projects/${item.id}`,
                })),
              }
            : undefined
        }
        activeProjectId={projectId}
        project={
          projectId && workspaceId
            ? {
                tasksHref: projectBasePath,
                tasksActive: isProjectTasksPath,
                sitesHref: `${projectBasePath}/apps/sites`,
                filesHref: `${projectBasePath}/files`,
                settingsHref: `${projectBasePath}/settings`,
                attentionCount: projectAttentionCount,
              }
            : undefined
        }
        workspaceShortcuts={
          !workspaceId
            ? data?.map((item) => ({
                id: item.id,
                name: item.name,
                href: `/work/${item.id}`,
              }))
            : undefined
        }
        onNavigate={closeOnMobile}
        onNewTask={() => {
          void navigate(
            projectId && workspaceId
              ? `${projectBasePath}?new=1`
              : workspaceId
                ? `/work/${workspaceId}`
                : `${workPlaces.conversations}/tasks`,
          );
          closeOnMobile();
        }}
      />
    </SidebarShell>
  );
}

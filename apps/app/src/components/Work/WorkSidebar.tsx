import { SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { WorkSidebarNav } from "@ngriffin_uk/polychat-component-workspaces";
import { useLocation, useSearchParams } from "react-router";

import { SidebarFooter } from "~/components/Sidebar/SidebarFooter";
import { SidebarHeader } from "~/components/Sidebar/SidebarHeader";
import { useTaskAttention } from "~/hooks/useProjectTasks";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

import { useWorkData } from "./WorkDataContext";

interface WorkSidebarProps {
  workspaceId?: string;
  projectId?: string;
}

export function WorkSidebar({ workspaceId, projectId }: WorkSidebarProps) {
  const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore();
  const { workspacesQuery, workspaceQuery, projectQuery } = useWorkData();
  const { data } = workspacesQuery;
  const { data: workspace } = workspaceQuery;
  const { data: project } = projectQuery;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const {
    clearCurrentConversation,
    currentConversationId,
    setCurrentConversationId,
    setShowSearch,
  } = useChatStore();
  const routedConversationId = searchParams.get("completion_id") ?? undefined;
  const activeConversationId =
    routedConversationId ??
    project?.conversations.find((conversation) => conversation.id === currentConversationId)?.id;
  const { items: attentionItems } = useTaskAttention();
  const projectAttentionCount = projectId
    ? attentionItems.filter((item) => item.projectId === projectId).length
    : 0;
  const projectBasePath = `/work/${workspaceId ?? ""}/projects/${projectId ?? ""}`;
  const projectChatPath = `${projectBasePath}/chat`;

  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      onClose={() => setSidebarVisible(false)}
      label="Workspace navigation"
      header={<SidebarHeader />}
      footer={<SidebarFooter />}
    >
      <WorkSidebarNav
        workspacesHref="/work"
        workspace={
          workspace
            ? {
                id: workspace.id,
                name: workspace.name,
                role: workspace.role,
                projectsHref: `/work/${workspace.id}`,
                membersHref: `/work/${workspace.id}/members`,
                governanceHref: `/work/${workspace.id}/governance`,
                projects: workspace.projects.map((item) => ({
                  id: item.id,
                  name: item.name,
                  colour: item.colour,
                  href: `/work/${workspace.id}/projects/${item.id}`,
                })),
              }
            : undefined
        }
        activeProjectId={projectId}
        project={
          projectId && workspaceId
            ? {
                newConversationHref: projectChatPath,
                experiencesHref: `${projectBasePath}/experiences`,
                outputsHref: `${projectBasePath}/outputs`,
                sourcesHref: `${projectBasePath}/sources`,
                tasksHref: `${projectBasePath}/tasks`,
                attentionCount: projectAttentionCount,
                activityHref: `${projectBasePath}/activity`,
                capabilitiesHref: `${projectBasePath}/library`,
                conversations: (project?.conversations ?? []).map((conversation) => ({
                  id: conversation.id,
                  title: conversation.title,
                  href: `${projectChatPath}?completion_id=${encodeURIComponent(conversation.id)}`,
                  needsInput: attentionItems.some(
                    (item) => item.kind === "input" && item.conversationId === conversation.id,
                  ),
                })),
                isConversationRoute: pathname === projectChatPath,
                activeConversationId,
              }
            : undefined
        }
        workspaceShortcuts={
          !workspaceId
            ? data?.workspaces.map((item) => ({
                id: item.id,
                name: item.name,
                href: `/work/${item.id}`,
              }))
            : undefined
        }
        onSearch={() => setShowSearch(true)}
        onNavigate={closeOnMobile}
        onNewConversation={clearCurrentConversation}
        onSelectConversation={setCurrentConversationId}
      />
    </SidebarShell>
  );
}

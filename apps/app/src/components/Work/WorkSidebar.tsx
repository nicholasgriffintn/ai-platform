import {
  ConversationList,
  ConversationListControls,
  ConversationListSection,
  DEFAULT_WORK_CONVERSATION_LIST_FILTERS,
} from "@ngriffin_uk/polychat-component-navigation";
import { SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { WorkSidebarNav } from "@ngriffin_uk/polychat-component-workspaces";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { SidebarFooter } from "~/components/Sidebar/SidebarFooter";
import { SidebarHeader } from "~/components/Sidebar/SidebarHeader";
import { useTaskAttention } from "~/hooks/useProjectTasks";
import { buildConversationGroups } from "~/lib/conversation-groups";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

import { useWorkData } from "./WorkDataContext";

interface WorkSidebarProps {
  workspaceId?: string;
  projectId?: string;
}

export function WorkSidebar({ workspaceId, projectId }: WorkSidebarProps) {
  const {
    sidebarVisible,
    setSidebarVisible,
    isMobile,
    workConversationListFilters,
    setWorkConversationListFilters,
    resetWorkConversationListFilters,
  } = useUIStore();
  const { workspacesQuery, workspaceQuery, projectQuery } = useWorkData();
  const { data } = workspacesQuery;
  const { data: workspace } = workspaceQuery;
  const { data: project } = projectQuery;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const conversationGroups = buildConversationGroups(
    (project?.conversations ?? []).map((conversation) => ({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      needsInput: attentionItems.some(
        (item) => item.kind === "input" && item.conversationId === conversation.id,
      ),
    })),
    {
      groupBy: workConversationListFilters.groupBy,
      sortBy: workConversationListFilters.sortBy,
    },
  );

  const selectConversation = (conversationId: string | undefined) => {
    if (!conversationId) {
      return;
    }

    setCurrentConversationId(conversationId);
    void navigate(`${projectChatPath}?completion_id=${encodeURIComponent(conversationId)}`);
    closeOnMobile();
  };

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
                conversationList: (
                  <div className="-mx-2 pt-3">
                    <ConversationListSection
                      isEmpty={(project?.conversations.length ?? 0) === 0}
                      controls={
                        <ConversationListControls
                          defaults={DEFAULT_WORK_CONVERSATION_LIST_FILTERS}
                          filters={workConversationListFilters}
                          showListFilters={false}
                          onFiltersChange={setWorkConversationListFilters}
                          onReset={resetWorkConversationListFilters}
                        />
                      }
                    >
                      <ConversationList
                        groups={conversationGroups}
                        activeConversationId={activeConversationId}
                        isConversationRoute={pathname === projectChatPath}
                        onSelect={selectConversation}
                      />
                    </ConversationListSection>
                  </div>
                ),
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
      />
    </SidebarShell>
  );
}

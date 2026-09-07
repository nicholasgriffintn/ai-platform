import {
  ConversationList,
  ConversationListControls,
  ConversationListSection,
  DEFAULT_WORK_CONVERSATION_LIST_FILTERS,
} from "@ngriffin_uk/polychat-component-navigation";
import { ConfirmationDialog, SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { WorkSidebarNav } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  useTaskAttention,
  useStartNewChat,
  getProjectBasePath,
  getProjectChatPath,
  getProjectConversationPath,
  isProjectConversationPath,
  resolveProjectConversationId,
  buildConversationSections,
  getPlacePaths,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/react/shallow";

import { ConversationGroupsDialog } from "../Conversations/ConversationGroupsDialog.js";
import { ConversationItemActions } from "../Conversations/ConversationItemActions.js";
import { SidebarFooter } from "../Sidebar/SidebarFooter.js";
import { SidebarHeader } from "../Sidebar/SidebarHeader.js";
import { useProjectConversationActions } from "./useProjectConversationActions.js";
import { useWorkData } from "./WorkDataContext.js";

interface WorkSidebarProps {
  workspaceId?: string;
  projectId?: string;
}

const EMPTY_CONVERSATIONS: NonNullable<
  ReturnType<typeof useWorkData>["projectQuery"]["data"]
>["conversations"] = [];

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
  const [conversationForGroups, setConversationForGroups] = useState<string | null>(null);
  const { pathname, search } = useLocation();
  const { conversationId: pathConversationId } = useParams<"conversationId">();
  const navigate = useNavigate();
  const startNewChat = useStartNewChat();
  const {
    clearCurrentConversation,
    currentConversationId,
    setCurrentConversationId,
    setShowSearch,
  } = useChatStore();
  const routedConversationId = resolveProjectConversationId(pathConversationId, search);
  const activeConversationId =
    routedConversationId ??
    project?.conversations.find((conversation) => conversation.id === currentConversationId)?.id;
  const { items: attentionItems } = useTaskAttention();
  const projectConversations = project?.conversations ?? EMPTY_CONVERSATIONS;
  const conversationStreams = useStreamActivityStore(
    useShallow((state) =>
      projectConversations.map((conversation) => state.streams[conversation.id]?.status),
    ),
  );
  const projectAttentionCount = projectId
    ? attentionItems.filter((item) => item.projectId === projectId).length
    : 0;
  const canManageGroups = workspace?.role === "owner" || workspace?.role === "admin";
  const workPlaces = getPlacePaths("work");
  const projectBasePath = getProjectBasePath(workspaceId ?? "", projectId ?? "");
  const projectChatPath = getProjectChatPath(workspaceId ?? "", projectId ?? "");
  const isConversationRoute = isProjectConversationPath(pathname);
  const {
    confirmDeleteConversation,
    conversationToDelete,
    deletePending,
    editConversationTitle,
    requestDeleteConversation,
    setConversationToDelete,
  } = useProjectConversationActions({
    activeConversationId,
    projectChatPath,
    refreshProject: projectQuery.refetch,
  });
  const conversationSections = buildConversationSections(
    projectConversations.map((conversation, index) => ({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      isStreaming: conversationStreams[index] === "streaming",
      needsInput:
        attentionItems.some(
          (item) => item.kind === "input" && item.conversationId === conversation.id,
        ) || conversationStreams[index] === "action-required",
      isPinned: conversation.isPinned,
      isUnread: conversation.isUnread,
      group: conversation.group,
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
    void navigate(getProjectConversationPath(workspaceId ?? "", projectId ?? "", conversationId));
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
        workspacesHref={workPlaces.conversations}
        attentionHref={
          projectId ? `${workPlaces.attention}?projectId=${projectId}` : workPlaces.attention
        }
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
                filesHref: `${projectBasePath}/files`,
                tasksHref: `${projectBasePath}/tasks`,
                attentionCount: projectAttentionCount,
                activityHref: `${projectBasePath}/activity`,
                teammatesHref: `${projectBasePath}/teammates`,
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
                        sections={conversationSections}
                        activeConversationId={activeConversationId}
                        isConversationRoute={isConversationRoute}
                        onSelect={selectConversation}
                        renderItemActions={(conversation) => (
                          <ConversationItemActions
                            conversation={conversation}
                            projectId={projectId}
                            canOrganise
                            canManageGroups={canManageGroups}
                            onEditTitle={(conversationId, currentTitle) => {
                              void editConversationTitle(conversationId, currentTitle);
                            }}
                            onDelete={requestDeleteConversation}
                            onManageGroups={setConversationForGroups}
                          />
                        )}
                      />
                    </ConversationListSection>
                  </div>
                ),
                isConversationRoute,
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
        onNewChat={() => {
          startNewChat();
          closeOnMobile();
        }}
        onNewConversation={clearCurrentConversation}
      />

      <ConfirmationDialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
        title="Delete conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDeleteConversation}
        isLoading={deletePending}
      />
      <ConversationGroupsDialog
        conversationId={conversationForGroups}
        projectId={projectId}
        canManageGroups={canManageGroups}
        onOpenChange={(open) => !open && setConversationForGroups(null)}
      />
    </SidebarShell>
  );
}

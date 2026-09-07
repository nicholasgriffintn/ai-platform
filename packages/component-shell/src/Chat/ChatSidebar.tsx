import {
  ConversationList,
  ConversationListActions,
  ConversationListControls,
  ConversationListSection,
  ConversationStorageNotice,
  SidebarNavButton,
  SidebarNavSection,
} from "@ngriffin_uk/polychat-component-navigation";
import { ConfirmationDialog, SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { shouldExplainStorage } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  buildConversationSections,
  getPersonalConversationPath,
  MODE_BASE_PATHS,
  resolvePersonalConversationId,
  useChats,
  useDeleteChat,
  useSetAllChatsArchived,
  useTrackEvent,
  useUIStore,
  useUpdateChatTitle,
  useConversationStorage,
} from "@ngriffin_uk/polychat-library-react";
import { useLoadMoreOnIntersect } from "@ngriffin_uk/polychat-utility-react";
import { Loader2, Search, SquarePen } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { ConversationGroupsDialog } from "../Conversations/ConversationGroupsDialog.js";
import { ConversationItemActions } from "../Conversations/ConversationItemActions.js";
import { DiscoverSidebarSection } from "../Sidebar/DiscoverSidebarSection.js";
import { PlacesNavLinks } from "../Sidebar/PlacesNavLinks.js";
import { SidebarFooter } from "../Sidebar/SidebarFooter.js";
import { SidebarHeader } from "../Sidebar/SidebarHeader.js";

export interface ChatSidebarProps {
  contentOverride?: ReactNode;
  headerActions?: ReactNode;
}

export function ChatSidebar({ contentOverride, headerActions }: ChatSidebarProps) {
  const { trackEvent } = useTrackEvent();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { completionId } = useParams<"completionId">();
  const routedConversationId = resolvePersonalConversationId(completionId, search);
  const isConversationRoute =
    pathname === "/" || pathname === MODE_BASE_PATHS.chat || Boolean(completionId);
  const {
    sidebarVisible,
    setSidebarVisible,
    isMobile,
    chatConversationListFilters: conversationListFilters,
    setChatConversationListFilters: setConversationListFilters,
    resetChatConversationListFilters: resetConversationListFilters,
  } = useUIStore();
  const {
    currentConversationId,
    setCurrentConversationId,
    clearCurrentConversation,
    setShowSearch,
    isAuthenticated,
    isAuthenticationLoading,
  } = useChatStore();
  const { determineStorageMode } = useConversationStorage();
  const storageMode = determineStorageMode(currentConversationId);
  const storageNoticeReason = shouldExplainStorage(storageMode) ? storageMode.reason : null;

  const {
    data: conversations,
    total: matchingConversationCount,
    error: conversationsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch: refetchConversations,
  } = useChats({
    activity: conversationListFilters.activity,
    archived: conversationListFilters.archiveFilter,
    sortBy: conversationListFilters.sortBy,
  });
  const deleteChat = useDeleteChat();
  const conversationStreams = useStreamActivityStore((state) => state.streams);
  const updateTitle = useUpdateChatTitle();
  const setAllArchived = useSetAllChatsArchived();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [conversationForGroups, setConversationForGroups] = useState<string | null>(null);
  const [confirmArchiveAll, setConfirmArchiveAll] = useState<boolean | null>(null);
  const loadMoreConversations = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: loadMoreConversations,
  });

  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  const handleNewChatClick = () => {
    clearCurrentConversation();

    if (routedConversationId || !isConversationRoute) {
      void navigate(MODE_BASE_PATHS.chat);
    }

    trackEvent({
      name: "new_chat",
      category: "sidebar",
      label: "new_chat",
      value: 1,
    });

    closeOnMobile();
  };

  const handleConversationClick = (id: string | undefined) => {
    setCurrentConversationId(id);
    void navigate(id ? getPersonalConversationPath(id) : MODE_BASE_PATHS.chat);

    trackEvent({
      name: "conversation_click",
      category: "sidebar",
      label: "conversation_click",
      value: 1,
    });

    closeOnMobile();
  };

  const handleEditTitle = async (completion_id: string, currentTitle: string) => {
    const newTitle = prompt("Enter new title:", currentTitle);

    if (newTitle && newTitle !== currentTitle) {
      try {
        trackEvent({
          name: "edit_title",
          category: "sidebar",
          label: "edit_title",
          value: 1,
        });

        await updateTitle.mutateAsync({ completion_id, title: newTitle });
      } catch (error) {
        console.error("Failed to update title:", error);
        alert("Failed to update title. Please try again.");
      }
    }
  };

  const confirmDeleteChat = async () => {
    if (!confirmDelete) {
      return;
    }

    try {
      trackEvent({
        name: "delete_chat",
        category: "sidebar",
        label: "delete_chat",
        value: 1,
      });

      await deleteChat.mutateAsync(confirmDelete);
      if (currentConversationId === confirmDelete) {
        const firstConversation = conversations.find((c) => c.id !== confirmDelete);

        setCurrentConversationId(firstConversation?.id);
      }

      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const confirmSetAllArchived = async () => {
    if (confirmArchiveAll === null) {
      return;
    }

    try {
      trackEvent({
        name: confirmArchiveAll ? "archive_all_chats" : "restore_all_chats",
        category: "sidebar",
        label: confirmArchiveAll ? "archive_all_chats" : "restore_all_chats",
        value: matchingConversationCount,
      });

      await setAllArchived.mutateAsync({
        archived: confirmArchiveAll,
        options: {
          activity: conversationListFilters.activity,
          archived: conversationListFilters.archiveFilter,
        },
      });

      setConfirmArchiveAll(null);
    } catch (error) {
      console.error("Failed to update archived conversations:", error);
    }
  };

  const conversationSections = buildConversationSections(
    conversations.map((conversation) => ({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      lastMessageAt: conversation.last_message_at,
      isLocalOnly: conversation.isLocalOnly,
      parentConversationId: conversation.parent_conversation_id,
      isStreaming: conversationStreams[conversation.id ?? ""]?.status === "streaming",
      needsInput: conversationStreams[conversation.id ?? ""]?.status === "action-required",
      isPinned: conversation.isPinned,
      isUnread: conversation.isUnread,
      group: conversation.group,
    })),
    {
      groupBy: conversationListFilters.groupBy,
      sortBy: conversationListFilters.sortBy,
    },
  );

  return (
    <>
      <SidebarShell
        visible={sidebarVisible}
        isMobile={isMobile}
        onClose={() => setSidebarVisible(false)}
        label="Conversations"
        header={<SidebarHeader actions={headerActions} />}
        footer={<SidebarFooter />}
      >
        {sidebarVisible && !contentOverride && !isAuthenticationLoading && (
          <div>
            <ConversationStorageNotice reason={storageNoticeReason} />
          </div>
        )}

        {contentOverride ? (
          contentOverride
        ) : isAuthenticationLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <nav aria-label="Conversations">
            <div className="px-2 pb-3">
              <SidebarNavSection>
                <SidebarNavButton
                  icon={<SquarePen size={17} />}
                  isActive={isConversationRoute && !currentConversationId}
                  onClick={handleNewChatClick}
                >
                  New chat
                </SidebarNavButton>
                <SidebarNavButton
                  icon={<Search size={17} />}
                  onClick={() => setShowSearch(true)}
                  shortcut="⌘K"
                >
                  Search
                </SidebarNavButton>
                <PlacesNavLinks onNavigate={closeOnMobile} />
              </SidebarNavSection>
              {!isAuthenticated && (
                <div className="mt-4">
                  <DiscoverSidebarSection onNavigate={closeOnMobile} />
                </div>
              )}
            </div>
            <ConversationListSection
              isLoading={isLoading}
              hasError={!!conversationsError && conversations.length === 0}
              onRetry={() => refetchConversations()}
              isEmpty={conversations.length === 0}
              controls={
                <div className="flex items-center gap-0.5">
                  <ConversationListActions
                    archiveFilter={conversationListFilters.archiveFilter}
                    matchingCount={matchingConversationCount}
                    isBusy={setAllArchived.isPending}
                    onArchiveAll={() => setConfirmArchiveAll(true)}
                    onRestoreAll={() => setConfirmArchiveAll(false)}
                  />
                  <ConversationListControls
                    filters={conversationListFilters}
                    onFiltersChange={setConversationListFilters}
                    onReset={resetConversationListFilters}
                  />
                </div>
              }
            >
              <ConversationList
                sections={conversationSections}
                activeConversationId={currentConversationId}
                isConversationRoute={isConversationRoute}
                loadMoreRef={loadMoreRef}
                loadMoreSlot={
                  isFetchingNextPage ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : null
                }
                onSelect={handleConversationClick}
                renderItemActions={(conversation) => (
                  <ConversationItemActions
                    conversation={conversation}
                    canOrganise={!conversation.isLocalOnly}
                    canManageGroups
                    onEditTitle={(conversationId, currentTitle) => {
                      void handleEditTitle(conversationId, currentTitle);
                    }}
                    onDelete={setConfirmDelete}
                    onManageGroups={setConversationForGroups}
                  />
                )}
              />
            </ConversationListSection>
          </nav>
        )}
      </SidebarShell>

      <ConfirmationDialog
        open={confirmArchiveAll !== null}
        onOpenChange={(open) => !open && setConfirmArchiveAll(null)}
        title={confirmArchiveAll ? "Archive all conversations" : "Restore all conversations"}
        description={
          confirmArchiveAll
            ? `Archive the ${matchingConversationCount} conversations matching your current filters. You can bring them back from the Archived view.`
            : `Restore the ${matchingConversationCount} archived conversations matching your current filters back to your active list.`
        }
        confirmText={confirmArchiveAll ? "Archive all" : "Restore all"}
        onConfirm={confirmSetAllArchived}
        isLoading={setAllArchived.isPending}
      />

      <ConfirmationDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete Conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDeleteChat}
        isLoading={deleteChat.isPending}
      />
      <ConversationGroupsDialog
        conversationId={conversationForGroups}
        canManageGroups
        onOpenChange={(open) => !open && setConversationForGroups(null)}
      />
    </>
  );
}

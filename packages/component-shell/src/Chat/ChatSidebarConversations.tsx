import {
  ConversationList,
  ConversationListActions,
  ConversationListControls,
  ConversationListSection,
} from "@ngriffin_uk/polychat-component-navigation";
import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  buildConversationSections,
  getNotebookPath,
  getPersonalConversationPath,
  MODE_BASE_PATHS,
  PERSONAL_SURFACE,
  useChats,
  useNotebooks,
  useDeleteChat,
  useSetAllChatsArchived,
  useTrackEvent,
  useUIStore,
  useUpdateChatTitle,
} from "@ngriffin_uk/polychat-library-react";
import { useLoadMoreOnIntersect } from "@ngriffin_uk/polychat-utility-react";
import { Loader2 } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { ConversationItemActions } from "../Conversations/ConversationItemActions.js";
import {
  RenameConversationDialog,
  type RenameConversationTarget,
} from "../Conversations/RenameConversationDialog.js";

const ConversationGroupsDialog = lazy(() =>
  import("../Conversations/ConversationGroupsDialog.js").then((module) => ({
    default: module.ConversationGroupsDialog,
  })),
);

export interface ChatSidebarConversationsProps {
  isConversationRoute: boolean;
  activeNotebookId: string | undefined;
}

export const ChatSidebarConversations = memo(function ChatSidebarConversations({
  isConversationRoute,
  activeNotebookId,
}: ChatSidebarConversationsProps) {
  const { trackEvent } = useTrackEvent();
  const navigate = useNavigate();
  const {
    isMobile,
    setSidebarVisible,
    chatConversationListFilters: conversationListFilters,
    setChatConversationListFilters: setConversationListFilters,
    resetChatConversationListFilters: resetConversationListFilters,
  } = useUIStore(
    useShallow((state) => ({
      isMobile: state.isMobile,
      setSidebarVisible: state.setSidebarVisible,
      chatConversationListFilters: state.chatConversationListFilters,
      setChatConversationListFilters: state.setChatConversationListFilters,
      resetChatConversationListFilters: state.resetChatConversationListFilters,
    })),
  );
  const { currentConversationId, setCurrentConversationId, isAuthenticated } = useChatStore(
    useShallow((state) => ({
      currentConversationId: state.currentConversationId,
      setCurrentConversationId: state.setCurrentConversationId,
      isAuthenticated: state.isAuthenticated,
    })),
  );
  const {
    data: conversations,
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
    teammateThreads: "exclude",
  });
  const { data: notebooks } = useNotebooks(undefined, isAuthenticated);
  const deleteChat = useDeleteChat();
  const streamStatuses = useStreamActivityStore(
    useShallow((state) =>
      Object.fromEntries(Object.entries(state.streams).map(([id, stream]) => [id, stream?.status])),
    ),
  );
  const updateTitle = useUpdateChatTitle();
  const setAllArchived = useSetAllChatsArchived();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [conversationForGroups, setConversationForGroups] = useState<string | null>(null);
  const [confirmArchiveAll, setConfirmArchiveAll] = useState<boolean | null>(null);
  const [conversationToRename, setConversationToRename] = useState<RenameConversationTarget | null>(
    null,
  );
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

  const handleRenameConversation = async (completion_id: string, title: string) => {
    trackEvent({
      name: "edit_title",
      category: "sidebar",
      label: "edit_title",
      value: 1,
    });

    try {
      await updateTitle.mutateAsync({ completion_id, title });
      setConversationToRename(null);
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.error("Couldn't rename the conversation. Please try again.");
      throw error;
    }
  };

  const confirmDeleteChat = async () => {
    if (!confirmDelete) {
      return;
    }

    trackEvent({
      name: "delete_chat",
      category: "sidebar",
      label: "delete_chat",
      value: 1,
    });

    try {
      await deleteChat.mutateAsync(confirmDelete);
    } catch (error) {
      console.error("Failed to delete chat:", error);

      return;
    }

    if (currentConversationId === confirmDelete) {
      const firstConversation = conversations.find((c) => c.id !== confirmDelete);

      setCurrentConversationId(firstConversation?.id);
    }

    setConfirmDelete(null);
  };

  const confirmSetAllArchived = async () => {
    if (confirmArchiveAll === null) {
      return;
    }

    let changed: number;

    try {
      changed = await setAllArchived.mutateAsync({
        archived: confirmArchiveAll,
        options: {
          activity: conversationListFilters.activity,
          archived: conversationListFilters.archiveFilter,
          teammateThreads: "exclude",
        },
      });
    } catch (error) {
      console.error("Failed to update archived conversations:", error);

      return;
    }

    const eventName = confirmArchiveAll ? "archive_all_chats" : "restore_all_chats";

    trackEvent({ name: eventName, category: "sidebar", label: eventName, value: changed });
    setConfirmArchiveAll(null);
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
      isStreaming: streamStatuses[conversation.id ?? ""] === "streaming",
      needsInput: streamStatuses[conversation.id ?? ""] === "action-required",
      isPinned: conversation.isPinned,
      isUnread: conversation.isUnread,
      group: conversation.group,
    })),
    {
      groupBy: conversationListFilters.groupBy,
      sortBy: conversationListFilters.sortBy,
      notebooks: notebooks ?? [],
    },
  );

  return (
    <>
      <ConversationListSection
        isLoading={isLoading}
        hasError={!!conversationsError && conversations.length === 0}
        onRetry={() => refetchConversations()}
        isEmpty={conversations.length === 0}
        controls={
          <div className="flex items-center gap-0.5">
            <ConversationListActions
              archiveFilter={conversationListFilters.archiveFilter}
              hasConversations={conversations.length > 0}
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
          activeNotebookId={activeNotebookId}
          onOpenNotebook={(notebookId) => {
            void navigate(getNotebookPath(PERSONAL_SURFACE, notebookId));
            closeOnMobile();
          }}
          renderItemActions={(conversation) => (
            <ConversationItemActions
              conversation={conversation}
              canOrganise={!conversation.isLocalOnly}
              canManageGroups
              onEditTitle={(conversationId, currentTitle) =>
                setConversationToRename({ id: conversationId, title: currentTitle })
              }
              onDelete={setConfirmDelete}
              onManageGroups={setConversationForGroups}
            />
          )}
        />
      </ConversationListSection>

      <ConfirmationDialog
        open={confirmArchiveAll !== null}
        onOpenChange={(open) => !open && setConfirmArchiveAll(null)}
        title={confirmArchiveAll ? "Archive all conversations" : "Restore all conversations"}
        description={
          confirmArchiveAll
            ? "Archive every conversation matching your current filters. You can bring them back from the Archived view."
            : "Restore every archived conversation matching your current filters to your active list."
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
      <RenameConversationDialog
        target={conversationToRename}
        isSaving={updateTitle.isPending}
        onOpenChange={(open) => !open && setConversationToRename(null)}
        onRename={handleRenameConversation}
      />
      <Suspense fallback={null}>
        <ConversationGroupsDialog
          conversationId={conversationForGroups}
          canManageGroups
          onOpenChange={(open) => !open && setConversationForGroups(null)}
        />
      </Suspense>
    </>
  );
});

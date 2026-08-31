import { CanvasSidebarControls } from "@ngriffin_uk/polychat-component-experiences/media";
import {
  ConversationList,
  ConversationListActions,
  ConversationListControls,
  ConversationListSection,
  ConversationStorageNotice,
  SidebarNavButton,
  SidebarNavLink,
  SidebarNavSection,
} from "@ngriffin_uk/polychat-component-navigation";
import { Button, ConfirmationDialog, SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { useLoadMoreOnIntersect } from "@ngriffin_uk/polychat-utility-react";
import {
  Grid2X2,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Search,
  Settings2,
  SquarePen,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import type { CanvasStudioState } from "~/components/Canvas/useCanvasStudio";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useChats,
  useDeleteChat,
  useSetAllChatsArchived,
  useUpdateChatTitle,
} from "~/hooks/useChat";
import { buildConversationGroups } from "~/lib/conversation-groups";
import {
  getPersonalConversationPath,
  resolvePersonalConversationId,
} from "~/lib/conversation-route";
import { useChatStore } from "~/state/stores/chatStore";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";
import { useUIStore } from "~/state/stores/uiStore";

import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { SidebarHeader } from "../Sidebar/SidebarHeader";

interface ChatSidebarProps {
  canvas?: CanvasStudioState;
  isCanvasMode?: boolean;
  onCanvasModeChange?: (isCanvasMode: boolean) => void;
}

export const ChatSidebar = ({
  canvas,
  isCanvasMode = false,
  onCanvasModeChange,
}: ChatSidebarProps) => {
  const { trackEvent } = useTrackEvent();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { completionId } = useParams<"completionId">();
  const routedConversationId = resolvePersonalConversationId(completionId, search);
  const isConversationRoute = pathname === "/" || pathname === "/chat" || Boolean(completionId);
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
    isPro,
    localOnlyMode,
  } = useChatStore();

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
  const [confirmArchiveAll, setConfirmArchiveAll] = useState<boolean | null>(null);
  const loadMoreConversations = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: Boolean(hasNextPage),
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
      void navigate("/chat");
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
    void navigate(id ? getPersonalConversationPath(id) : "/chat");

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

  const toggleCanvasMode = () => {
    onCanvasModeChange?.(!isCanvasMode);

    trackEvent({
      name: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
      category: "sidebar",
      label: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
      value: 1,
    });
  };

  const conversationGroups = buildConversationGroups(
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
    })),
    {
      groupBy: conversationListFilters.groupBy,
      sortBy: conversationListFilters.sortBy,
    },
  );

  const sidebarHeader = (
    <SidebarHeader
      actions={
        canvas && onCanvasModeChange ? (
          <Button
            type="button"
            variant={isCanvasMode ? "iconActive" : "icon"}
            title={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
            aria-label={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
            icon={isCanvasMode ? <MessageCircle size={20} /> : <ImageIcon size={20} />}
            onClick={toggleCanvasMode}
          />
        ) : undefined
      }
    />
  );

  return (
    <>
      <SidebarShell
        visible={sidebarVisible}
        isMobile={isMobile}
        onClose={() => setSidebarVisible(false)}
        label="Conversations"
        header={sidebarHeader}
        footer={<SidebarFooter />}
      >
        {sidebarVisible && !isCanvasMode && !isAuthenticationLoading && (
          <div>
            <ConversationStorageNotice
              isAuthenticated={isAuthenticated}
              isPro={isPro}
              localOnlyMode={localOnlyMode}
            />
          </div>
        )}

        {isCanvasMode && canvas ? (
          <CanvasSidebarControls canvas={canvas} />
        ) : isAuthenticationLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Loader2 size={20} className="animate-spin text-zinc-600 dark:text-zinc-400" />
          </div>
        ) : (
          <div>
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
                {isAuthenticated && (
                  <>
                    <SidebarNavLink
                      href="/chat/experiences"
                      icon={<Grid2X2 size={16} />}
                      onClick={closeOnMobile}
                    >
                      Experiences
                    </SidebarNavLink>
                    <SidebarNavLink
                      href="/chat/capabilities"
                      icon={<Settings2 size={16} />}
                      onClick={closeOnMobile}
                    >
                      Capabilities
                    </SidebarNavLink>
                  </>
                )}
              </SidebarNavSection>
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
              {
                <ConversationList
                  groups={conversationGroups}
                  activeConversationId={currentConversationId}
                  isConversationRoute={isConversationRoute}
                  localOnlyMode={localOnlyMode}
                  loadMoreRef={loadMoreRef}
                  loadMoreSlot={
                    isFetchingNextPage ? (
                      <div className="flex justify-center py-2">
                        <Loader2
                          size={16}
                          className="animate-spin text-zinc-500 dark:text-zinc-400"
                        />
                      </div>
                    ) : null
                  }
                  onSelect={handleConversationClick}
                  onEditTitle={handleEditTitle}
                  onDelete={(conversationId) => setConfirmDelete(conversationId)}
                />
              }
            </ConversationListSection>
          </div>
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
    </>
  );
};

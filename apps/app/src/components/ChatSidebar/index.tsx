import {
  Cloud,
  CloudOff,
  Edit,
  GitBranch,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmationDialog,
  HoverActions,
  ListItem,
  SidebarShell,
} from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChats, useDeleteChat, useUpdateChatTitle } from "~/hooks/useChat";
import { categorizeItemsByDate } from "~/lib/sidebar";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { Conversation } from "~/types/chat";
import { ChatThemeDropdown } from "../Sidebar/ChatThemeDropdown";
import { MoreOptionsDropdown } from "../Sidebar/MoreOptionsDropdown";
import { UserMenuItem } from "../Sidebar/UserMenuItem";
import { ChatSidebarNotifications } from "./ChatSidebarNotifications";

export const ChatSidebar = () => {
  const { trackEvent } = useTrackEvent();
  const {
    sidebarVisible,
    setSidebarVisible,
    isMobile,
    setShowKeyboardShortcuts,
  } = useUIStore();
  const {
    currentConversationId,
    setCurrentConversationId,
    clearCurrentConversation,
    isAuthenticated,
    isAuthenticationLoading,
    isPro,
    localOnlyMode,
    setLocalOnlyMode,
  } = useChatStore();

  const { data: conversations = [], isLoading } = useChats();
  const deleteChat = useDeleteChat();
  const updateTitle = useUpdateChatTitle();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const categorizedChats = categorizeItemsByDate(conversations, (c) => {
    if (c.created_at) return new Date(c.created_at);
    if (c.updated_at) return new Date(c.updated_at);
    if (c.last_message_at) return new Date(c.last_message_at);
    return new Date(0);
  });

  const handleNewChatClick = () => {
    clearCurrentConversation();

    trackEvent({
      name: "new_chat",
      category: "sidebar",
      label: "new_chat",
      value: 1,
    });

    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  const handleConversationClick = (id: string | undefined) => {
    setCurrentConversationId(id);

    trackEvent({
      name: "conversation_click",
      category: "sidebar",
      label: "conversation_click",
      value: 1,
    });

    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  const handleEditTitle = async (
    completion_id: string,
    currentTitle: string,
  ) => {
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

  const handleDeleteChat = async (
    completion_id: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setConfirmDelete(completion_id);
  };

  const confirmDeleteChat = async () => {
    if (!confirmDelete) return;

    try {
      trackEvent({
        name: "delete_chat",
        category: "sidebar",
        label: "delete_chat",
        value: 1,
      });

      await deleteChat.mutateAsync(confirmDelete);
      if (currentConversationId === confirmDelete) {
        const firstConversation = conversations.find(
          (c) => c.id !== confirmDelete,
        );
        setCurrentConversationId(firstConversation?.id);
      }
      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const toggleLocalOnlyMode = () => {
    const newMode = !localOnlyMode;
    setLocalOnlyMode(newMode);
    if (window.localStorage) {
      window.localStorage.setItem("localOnlyMode", String(newMode));
    }

    trackEvent({
      name: "toggle_local_only_mode",
      category: "sidebar",
      label: "toggle_local_only_mode",
      value: newMode ? "local-only" : "cloud",
    });
  };

  const renderConversationGroup = (
    title: string,
    conversationsList: Conversation[],
  ) => {
    if (!conversationsList || conversationsList.length === 0) return null;

    return (
      <div key={title}>
        <h3 className="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {title}
        </h3>
        <ul className="space-y-1 mb-3">
          {conversationsList.map((conversation) => (
            <ListItem
              key={conversation.id}
              data-id={conversation.id}
              isActive={currentConversationId === conversation.id}
              badge={
                <>
                  {(conversation.isLocalOnly || localOnlyMode) && (
                    <span className="text-xs text-blue-500 dark:text-blue-400 inline-flex items-center">
                      <CloudOff size={14} className="mr-1" />
                      <span className="sr-only">Local only</span>
                    </span>
                  )}
                  {conversation.parent_conversation_id && (
                    <span
                      className="text-xs text-zinc-600 dark:text-zinc-400 inline-flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                      title="Go to original conversation"
                      aria-label="Go to original conversation"
                      onClick={(e) => {
                        e?.stopPropagation();
                        handleConversationClick(
                          conversation.parent_conversation_id,
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          handleConversationClick(
                            conversation.parent_conversation_id!,
                          );
                        }
                      }}
                    >
                      <GitBranch size={14} className="mr-1" />
                    </span>
                  )}
                </>
              }
              label={conversation.title || "New conversation"}
              onClick={() => handleConversationClick(conversation.id)}
              actions={
                conversation.id ? (
                  <HoverActions
                    actions={[
                      {
                        id: "edit",
                        icon: <Edit size={14} />,
                        label: "Edit conversation title",
                        onClick: (e) => {
                          e.stopPropagation();
                          handleEditTitle(
                            conversation.id || "",
                            conversation.title || "",
                          );
                        },
                      },
                      {
                        id: "delete",
                        icon: <Trash2 size={14} />,
                        label: "Delete",
                        onClick: (e) => {
                          e.stopPropagation();
                          handleDeleteChat(conversation.id || "", e);
                        },
                      },
                    ]}
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      </div>
    );
  };

  const sidebarHeader = (
    <div className="h-[44px]">
      <div className="mx-2 my-2 flex items-center justify-between h-[37px]">
        <Button
          type="button"
          variant="icon"
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          icon={
            sidebarVisible ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )
          }
          onClick={() => setSidebarVisible(!sidebarVisible)}
        />

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Button
              type="button"
              variant={localOnlyMode ? "iconActive" : "icon"}
              title={
                localOnlyMode
                  ? "Switch to cloud mode"
                  : "Switch to local-only mode"
              }
              aria-label={
                localOnlyMode
                  ? "Switch to cloud mode"
                  : "Switch to local-only mode"
              }
              icon={
                localOnlyMode ? <CloudOff size={20} /> : <Cloud size={20} />
              }
              onClick={toggleLocalOnlyMode}
            />
          )}
        </div>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="p-2 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex justify-between items-center">
        <div>
          <UserMenuItem />
        </div>
        <div className="flex items-center gap-2">
          <ChatThemeDropdown position="top" />
          <MoreOptionsDropdown
            position="top"
            onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SidebarShell
        visible={sidebarVisible}
        isMobile={isMobile}
        onClose={() => setSidebarVisible(false)}
        header={sidebarHeader}
        footer={sidebarFooter}
      >
        {sidebarVisible && !isAuthenticationLoading && (
          <div>
            <ChatSidebarNotifications
              isAuthenticated={isAuthenticated}
              isPro={isPro}
              localOnlyMode={localOnlyMode}
            />
          </div>
        )}

        {isAuthenticationLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Loader2
              size={20}
              className="animate-spin text-zinc-600 dark:text-zinc-400"
            />
          </div>
        ) : (
          <div>
            <div className="p-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleNewChatClick}
                className="w-full bg-zinc-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700"
                icon={<SquarePen size={20} />}
              >
                New Chat
              </Button>
            </div>
            {isLoading ? (
              <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
                No conversations yet
              </div>
            ) : (
              <div className="p-2">
                {renderConversationGroup("Today", categorizedChats.today)}
                {renderConversationGroup(
                  "Yesterday",
                  categorizedChats.yesterday,
                )}
                {renderConversationGroup(
                  "This Week",
                  categorizedChats.thisWeek,
                )}
                {renderConversationGroup(
                  "This Month",
                  categorizedChats.thisMonth,
                )}
                {renderConversationGroup(
                  "Last Month",
                  categorizedChats.lastMonth,
                )}
                {renderConversationGroup("Older", categorizedChats.older)}
              </div>
            )}
          </div>
        )}
      </SidebarShell>

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

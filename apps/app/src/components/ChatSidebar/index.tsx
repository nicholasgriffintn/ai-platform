import {
  Cloud,
  CloudOff,
  Edit,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  Trash2,
} from "lucide-react";

import { Button } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChats, useDeleteChat, useUpdateChatTitle } from "~/hooks/useChat";
import { categorizeChatsByDate } from "~/lib/sidebar";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation } from "~/types/chat";
import { ChatThemeDropdown } from "../Sidebar/ChatThemeDropdown";
import { MoreOptionsDropdown } from "../Sidebar/MoreOptionsDropdown";
import { UserMenuItem } from "../Sidebar/UserMenuItem";
import { ChatSidebarNotifications } from "./ChatSidebarNotifications";

export const ChatSidebar = () => {
  const trackEvent = useTrackEvent();
  const {
    sidebarVisible,
    setSidebarVisible,
    currentConversationId,
    setCurrentConversationId,
    clearCurrentConversation,
    isAuthenticated,
    isAuthenticationLoading,
    isPro,
    localOnlyMode,
    setLocalOnlyMode,
    isMobile,
    setShowKeyboardShortcuts,
  } = useChatStore();

  const { data: conversations = [], isLoading } = useChats();
  const deleteChat = useDeleteChat();
  const updateTitle = useUpdateChatTitle();

  const categorizedChats = categorizeChatsByDate(conversations);

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
    if (!window.confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      trackEvent({
        name: "delete_chat",
        category: "sidebar",
        label: "delete_chat",
        value: 1,
      });

      await deleteChat.mutateAsync(completion_id);
      if (currentConversationId === completion_id) {
        const firstConversation = conversations.find(
          (c) => c.id !== completion_id,
        );
        setCurrentConversationId(firstConversation?.id);
      }
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
            <li
              data-conversation-id={conversation.id}
              key={conversation.id}
              className={`group flex items-center relative p-2 rounded-lg cursor-pointer
								${
                  currentConversationId === conversation.id
                    ? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
                    : "hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                }
							`}
              onClick={() => handleConversationClick(conversation.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleConversationClick(conversation.id);
                }
              }}
            >
              <div className="md:w-full md:group-hover:w-[calc(100%-60px)] w-[calc(100%-60px)] overflow-hidden pr-1 transition-all duration-200 flex items-center">
                {(conversation.isLocalOnly || localOnlyMode) && (
                  <span className="mr-2 text-xs text-blue-500 dark:text-blue-400 inline-flex items-center flex-shrink-0">
                    <CloudOff size={14} className="mr-1" />
                    <span className="sr-only">Local only</span>
                  </span>
                )}
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {conversation.title || "New conversation"}
                </span>
              </div>
              {conversation.id && (
                <div className="absolute right-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity duration-200 flex items-center space-x-1 bg-inherit">
                  <Button
                    type="button"
                    variant="icon"
                    title="Edit conversation title"
                    aria-label="Edit conversation title"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTitle(
                        conversation.id || "",
                        conversation.title || "",
                      );
                    }}
                    icon={<Edit size={14} />}
                    size="icon"
                  />
                  <Button
                    type="button"
                    variant="icon"
                    onClick={(e) => handleDeleteChat(conversation.id || "", e)}
                    icon={<Trash2 size={14} />}
                    size="icon"
                    title="Delete"
                    aria-label="Delete conversation"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      {sidebarVisible && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setSidebarVisible(false)}
          onKeyDown={(e) => e.key === "Enter" && setSidebarVisible(false)}
        />
      )}
      <div
        className={`fixed md:relative
          z-50
          h-full w-64
          bg-off-white dark:bg-zinc-900
          transition-transform duration-300 ease-in-out
          border-r border-zinc-200 dark:border-zinc-800
          ${sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"}
        `}
      >
        {sidebarVisible && (
          <div className="flex flex-col h-full w-64 overflow-hidden">
            <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 md:border-r z-10 w-full h-[53px]">
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
                        localOnlyMode ? (
                          <CloudOff size={20} />
                        ) : (
                          <Cloud size={20} />
                        )
                      }
                      onClick={toggleLocalOnlyMode}
                    />
                  )}
                </div>
              </div>
            </div>

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
              <div
                className={`overflow-y-auto ${conversations.length > 0 ? "h-[calc(100vh-9rem)]" : "h-[calc(100vh-5rem)]"}`}
              >
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

            <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div className="flex justify-between items-center">
                <div>
                  <UserMenuItem />
                </div>
                <div className="flex items-center gap-2">
                  <ChatThemeDropdown position="top" />
                  <MoreOptionsDropdown
                    position="top"
                    onShowKeyboardShortcuts={() =>
                      setShowKeyboardShortcuts(true)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

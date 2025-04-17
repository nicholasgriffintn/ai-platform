import { useDeleteAllChats } from "~/hooks/useChat";
import { useChatStore } from "~/state/stores/chatStore";
import { ChatThemeDropdown } from "./ChatThemeDropdown";
import { MoreOptionsDropdown } from "./MoreOptionsDropdown";
import { UserMenuItem } from "./UserMenuItem";

interface SidebarFooterProps {
  enableClearAllMessages?: boolean;
}

export function SidebarFooter({
  enableClearAllMessages = true,
}: SidebarFooterProps) {
  const { setShowKeyboardShortcuts } = useChatStore();
  const deleteAllChatsMutation = useDeleteAllChats();

  const handleClearAllMessages = async () => {
    if (!enableClearAllMessages) return;
    if (
      !window.confirm(
        "Are you sure you want to delete all conversations? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteAllChatsMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to delete all chats:", error);
      alert("Failed to delete all conversations. Please try again.");
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex justify-between items-center">
        <div>
          <UserMenuItem />
        </div>
        <div className="flex items-center gap-2">
          <ChatThemeDropdown position="top" />
          <MoreOptionsDropdown
            position="top"
            onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
            onClearAllMessages={handleClearAllMessages}
            disableClearAllMessages={!enableClearAllMessages}
          />
        </div>
      </div>
    </div>
  );
}

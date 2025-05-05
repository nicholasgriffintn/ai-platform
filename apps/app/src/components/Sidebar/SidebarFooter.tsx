import { useChatStore } from "~/state/stores/chatStore";
import { ChatThemeDropdown } from "./ChatThemeDropdown";
import { MoreOptionsDropdown } from "./MoreOptionsDropdown";
import { UserMenuItem } from "./UserMenuItem";

export function SidebarFooter() {
  const { setShowKeyboardShortcuts } = useChatStore();

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
          />
        </div>
      </div>
    </div>
  );
}

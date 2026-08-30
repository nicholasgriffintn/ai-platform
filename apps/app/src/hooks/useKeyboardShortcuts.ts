import { useEffect } from "react";

import { type AppKeyboardShortcutId, matchesAppKeyboardShortcut } from "~/lib/keyboard-shortcuts";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

type ShortcutHandler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts() {
  const { setSidebarVisible, sidebarVisible, showKeyboardShortcuts, setShowKeyboardShortcuts } =
    useUIStore();
  const { clearCurrentConversation, setShowSearch, localOnlyMode, setLocalOnlyMode } =
    useChatStore();

  useEffect(() => {
    const handlers: Partial<Record<AppKeyboardShortcutId, ShortcutHandler>> = {
      search: (e) => {
        e.preventDefault();
        setShowSearch(true);
      },
      "new-chat": (e) => {
        e.preventDefault();
        clearCurrentConversation();
      },
      "toggle-sidebar": (e) => {
        e.preventDefault();
        setSidebarVisible(!sidebarVisible);
      },
      "toggle-keyboard-shortcuts": (e) => {
        e.preventDefault();
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
      },
      "toggle-local-only-mode": (e) => {
        e.preventDefault();
        setLocalOnlyMode(!localOnlyMode);
      },
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      for (const [id, handler] of Object.entries(handlers)) {
        if (handler && matchesAppKeyboardShortcut(e, id as AppKeyboardShortcutId)) {
          handler(e);

          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    clearCurrentConversation,
    setSidebarVisible,
    sidebarVisible,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    setShowSearch,
    localOnlyMode,
    setLocalOnlyMode,
  ]);

  return {};
}

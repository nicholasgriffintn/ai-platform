import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import {
  type AppKeyboardShortcutId,
  dispatchModelSelectorShortcut,
  matchesAppKeyboardShortcut,
} from "../lib/keyboard-shortcuts.js";
import { useUIStore } from "../state/stores/uiStore.js";

type ShortcutHandler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts() {
  const {
    setSidebarVisible,
    sidebarVisible,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showMetaAssistant,
    setShowMetaAssistant,
  } = useUIStore();
  const { clearCurrentConversation, setShowSearch } = useChatStore();

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
      "toggle-meta-assistant": (e) => {
        e.preventDefault();
        setShowMetaAssistant(!showMetaAssistant);
      },
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesAppKeyboardShortcut(e, "open-model-selector")) {
        e.preventDefault();
        dispatchModelSelectorShortcut("open");

        return;
      }

      if (matchesAppKeyboardShortcut(e, "cycle-compute-site")) {
        e.preventDefault();
        dispatchModelSelectorShortcut("cycle-compute-site");

        return;
      }

      if (matchesAppKeyboardShortcut(e, "toggle-retention")) {
        e.preventDefault();
        dispatchModelSelectorShortcut("toggle-retention");

        return;
      }

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
    showMetaAssistant,
    setShowMetaAssistant,
  ]);

  return {};
}

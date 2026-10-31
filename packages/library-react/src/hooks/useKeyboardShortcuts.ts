import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { isTextEntryTarget } from "@ngriffin_uk/polychat-utility-react";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

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
    showPoly,
    setShowPoly,
  } = useUIStore(
    useShallow((state) => ({
      setSidebarVisible: state.setSidebarVisible,
      sidebarVisible: state.sidebarVisible,
      showKeyboardShortcuts: state.showKeyboardShortcuts,
      setShowKeyboardShortcuts: state.setShowKeyboardShortcuts,
      showPoly: state.showPoly,
      setShowPoly: state.setShowPoly,
    })),
  );
  const { clearCurrentConversation, setShowSearch } = useChatStore(
    useShallow((state) => ({
      clearCurrentConversation: state.clearCurrentConversation,
      setShowSearch: state.setShowSearch,
    })),
  );

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
      "toggle-poly": (e) => {
        e.preventDefault();
        setShowPoly(!showPoly);
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

      if (isTextEntryTarget(e.target)) {
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
    showPoly,
    setShowPoly,
  ]);

  return {};
}

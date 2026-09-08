import {
  resolveConversationStorageMode,
  type ChatRequestOptions,
  type ConversationStorageMode,
} from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ConversationRetention } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect } from "react";

import {
  getModelSelectorShortcut,
  MODEL_SELECTOR_SHORTCUT_EVENT,
} from "../lib/keyboard-shortcuts.js";

export interface ConversationRetentionState {
  mode: ConversationStorageMode;
  isLocked: boolean;
  setRetention: (retention: ConversationRetention) => void;
  toggle: () => void;
}

export function useConversationRetention(
  requestOptions?: ChatRequestOptions,
): ConversationRetentionState {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);
  const temporaryChat = useChatStore((state) => state.temporaryChat);
  const temporaryChatsDefault = useChatStore((state) => state.temporaryChatsDefault);
  const setTemporaryChat = useChatStore((state) => state.setTemporaryChat);
  const computeSite = useChatStore((state) => state.computeSite);
  const mode = resolveConversationStorageMode(
    {
      isAuthenticated,
      isPro,
      temporaryChat,
      temporaryChatsDefault,
      runsOnDevice: computeSite !== "hosted",
    },
    requestOptions,
  );
  const isLocked = !isAuthenticated || !isPro || mode.isProjectScoped;

  const setRetention = useCallback(
    (retention: ConversationRetention) => {
      if (isLocked) {
        return;
      }

      setTemporaryChat(retention === "temporary");
    },
    [isLocked, setTemporaryChat],
  );
  const toggle = useCallback(
    () => setRetention(mode.retention === "kept" ? "temporary" : "kept"),
    [mode.retention, setRetention],
  );

  useEffect(() => {
    const handleShortcut = (event: Event) => {
      if (getModelSelectorShortcut(event) === "toggle-retention") {
        toggle();
      }
    };

    window.addEventListener(MODEL_SELECTOR_SHORTCUT_EVENT, handleShortcut);

    return () => window.removeEventListener(MODEL_SELECTOR_SHORTCUT_EVENT, handleShortcut);
  }, [toggle]);

  return { mode, isLocked, setRetention, toggle };
}

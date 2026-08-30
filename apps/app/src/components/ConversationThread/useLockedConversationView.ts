import {
  LOCKED_CONTEXT_CAP_MESSAGE,
  measureLockedContext,
} from "@ngriffin_uk/polychat-library-chat/locked-conversation-cap";
import { useMemo } from "react";

import { useChat } from "~/hooks/useChat";
import { isConversationLocked, useConversationLockState } from "~/hooks/useConversationLock";
import type { Message } from "~/types";

import type { ConversationThreadModeConfig } from ".";

export interface LockedConversationView {
  /** The conversation is sealed and this tab does not hold its key. */
  isSealed: boolean;
  isLocked: boolean;
  /** Set when the thread has grown past what a locked conversation can carry. */
  capMessage: string | null;
  modeConfig: ConversationThreadModeConfig | undefined;
}

const LOCKED_PLACEHOLDER = {
  newConversation: "Message this locked chat",
  followUp: "Message this locked chat",
};

const SEALED_PLACEHOLDER = {
  newConversation: "Unlock this chat to keep going",
  followUp: "Unlock this chat to keep going",
};

/**
 * A locked conversation is the ordinary thread with every capability that would write
 * plaintext taken away. Deriving the composer config here keeps that list in one place
 * instead of scattering conditionals through the thread.
 */
export function useLockedConversationView(
  modeConfig: ConversationThreadModeConfig | undefined,
  conversationId: string | undefined,
  messages: Message[],
): LockedConversationView {
  const { data: conversation } = useChat(conversationId);
  const { isUnlocked } = useConversationLockState(conversationId);
  const isLocked = isConversationLocked(conversation);
  const isSealed = isLocked && !isUnlocked;

  const capMessage = useMemo(() => {
    if (!isLocked || isSealed) {
      return null;
    }

    return measureLockedContext(messages).isOverCap ? LOCKED_CONTEXT_CAP_MESSAGE : null;
  }, [isLocked, isSealed, messages]);

  const lockedModeConfig = useMemo<ConversationThreadModeConfig | undefined>(() => {
    if (!isLocked) {
      return modeConfig;
    }

    return {
      ...modeConfig,
      hideChatSettings: true,
      hideComposerActionMenu: true,
      hideComposerSuggestions: true,
      hideSubmitButton: isSealed || Boolean(capMessage),
      hideTextInput: isSealed,
      inputPlaceholder: isSealed ? SEALED_PLACEHOLDER : LOCKED_PLACEHOLDER,
      toolSelectionLocked: true,
      welcomeCapabilitySuggestions: false,
    };
  }, [capMessage, isLocked, isSealed, modeConfig]);

  return { capMessage, isLocked, isSealed, modeConfig: lockedModeConfig };
}

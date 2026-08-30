import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

export type ChatMode = "remote" | "local" | "tool" | "agent";
export type ChatRequestOptions = Partial<ChatCompletionRequestBody>;

export interface ConversationStorageState {
  chatMode: ChatMode;
  isAuthenticated: boolean;
  isLocked?: boolean;
  isPro: boolean;
  localOnlyMode: boolean;
  settingsLocalOnly: boolean;
}

export interface ConversationStorageMode {
  isLocalOnly: boolean;
  isLocked: boolean;
  isProjectScoped: boolean;
  /** Whether plaintext may be written anywhere it outlives the tab. */
  shouldPersistPlaintext: boolean;
  /** Whether sealed envelopes are mirrored to the API. */
  shouldSyncEnvelopes: boolean;
  shouldSyncRemote: boolean;
}

/**
 * Locked conversations extend local-only mode rather than replacing it: neither sends
 * plaintext to the API. A locked conversation goes further and keeps plaintext out of
 * device storage too, so the only durable copy anywhere is the sealed envelope.
 */
export function resolveConversationStorageMode(
  state: ConversationStorageState,
  requestOptions?: ChatRequestOptions,
): ConversationStorageMode {
  const isProjectScoped = Boolean(requestOptions?.metadata?.project_id);
  const isLocked = Boolean(state.isLocked);

  if (isLocked) {
    return {
      isLocalOnly: true,
      isLocked: true,
      isProjectScoped: false,
      shouldPersistPlaintext: false,
      shouldSyncEnvelopes: state.isAuthenticated && state.isPro,
      shouldSyncRemote: false,
    };
  }

  const isLocalOnly =
    !state.isAuthenticated ||
    !state.isPro ||
    (!isProjectScoped &&
      (state.localOnlyMode || state.settingsLocalOnly || state.chatMode === "local"));

  return {
    isLocalOnly,
    isLocked: false,
    isProjectScoped,
    shouldPersistPlaintext: true,
    shouldSyncEnvelopes: false,
    shouldSyncRemote: !isLocalOnly,
  };
}

/** Locking is a Pro capability because it depends on server-side conversation sync. */
export function canLockConversations(state: { isAuthenticated: boolean; isPro: boolean }): boolean {
  return state.isAuthenticated && state.isPro;
}

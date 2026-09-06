import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

export type ChatRequestOptions = Partial<ChatCompletionRequestBody>;

export interface ConversationStorageState {
  isAuthenticated: boolean;
  isPro: boolean;
  temporaryChat: boolean;
  temporaryChatsDefault: boolean;
}

export interface ConversationStorageMode {
  isTemporary: boolean;
  isProjectScoped: boolean;
  shouldSyncRemote: boolean;
}

export function resolveConversationStorageMode(
  state: ConversationStorageState,
  requestOptions?: ChatRequestOptions,
): ConversationStorageMode {
  const isProjectScoped = Boolean(requestOptions?.metadata?.project_id);

  if (isProjectScoped) {
    return { isTemporary: false, isProjectScoped, shouldSyncRemote: true };
  }

  const isTemporary =
    !state.isAuthenticated || !state.isPro || state.temporaryChat || state.temporaryChatsDefault;

  return { isTemporary, isProjectScoped, shouldSyncRemote: !isTemporary };
}

import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

export type ChatRequestOptions = Partial<ChatCompletionRequestBody>;

export interface ConversationStorageState {
  isAuthenticated: boolean;
  isPro: boolean;
  temporaryChat: boolean;
  temporaryChatsDefault: boolean;
  /** The answer is being produced on this machine, so its content never reaches the service. */
  runsOnDevice?: boolean;
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
  const isProjectScoped = Boolean(requestOptions?.metadata?.project_id) && !state.runsOnDevice;

  if (isProjectScoped) {
    return { isTemporary: false, isProjectScoped, shouldSyncRemote: true };
  }

  const isTemporary =
    Boolean(state.runsOnDevice) ||
    !state.isAuthenticated ||
    !state.isPro ||
    state.temporaryChat ||
    state.temporaryChatsDefault;

  return { isTemporary, isProjectScoped, shouldSyncRemote: !isTemporary };
}

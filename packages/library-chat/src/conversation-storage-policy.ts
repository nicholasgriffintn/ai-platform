import type { ChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

export type ChatMode = "remote" | "local" | "tool" | "agent";
export type ChatRequestOptions = Partial<ChatCompletionRequestBody>;

export interface ConversationStorageState {
  chatMode: ChatMode;
  isAuthenticated: boolean;
  isPro: boolean;
  localOnlyMode: boolean;
  settingsLocalOnly: boolean;
}

export function resolveConversationStorageMode(
  state: ConversationStorageState,
  requestOptions?: ChatRequestOptions,
) {
  const isProjectScoped = Boolean(requestOptions?.metadata?.project_id);
  const isLocalOnly =
    !state.isAuthenticated ||
    !state.isPro ||
    (!isProjectScoped &&
      (state.localOnlyMode || state.settingsLocalOnly || state.chatMode === "local"));

  return { isLocalOnly, isProjectScoped, shouldSyncRemote: !isLocalOnly };
}

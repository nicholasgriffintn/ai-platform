import type {
  ChatCompletionRequestBody,
  ConversationRetention,
  RetentionReason,
} from "@ngriffin_uk/polychat-schemas";

export type { ConversationRetention, RetentionReason } from "@ngriffin_uk/polychat-schemas";

export type ChatRequestOptions = Partial<ChatCompletionRequestBody>;

export interface ConversationStorageState {
  isAuthenticated: boolean;
  isPro: boolean;
  temporaryChat?: boolean;
  temporaryChatsDefault: boolean;
  runsOnDevice?: boolean;
}

export interface ConversationStorageMode {
  retention: ConversationRetention;
  reason: RetentionReason;
  isProjectScoped: boolean;
}

export function resolveConversationStorageMode(
  state: ConversationStorageState,
  requestOptions?: ChatRequestOptions,
): ConversationStorageMode {
  const isProjectScoped = Boolean(requestOptions?.metadata?.project_id);

  if (!state.isAuthenticated) {
    return { retention: "temporary", reason: "signed_out", isProjectScoped };
  }

  if (!state.isPro) {
    return { retention: "temporary", reason: "plan", isProjectScoped };
  }

  if (isProjectScoped) {
    return { retention: "kept", reason: "chosen", isProjectScoped };
  }

  if (state.temporaryChat !== undefined) {
    return {
      retention: state.temporaryChat ? "temporary" : "kept",
      reason: "chosen",
      isProjectScoped,
    };
  }

  if (state.temporaryChatsDefault) {
    return { retention: "temporary", reason: "default", isProjectScoped };
  }

  return {
    retention: "kept",
    reason: state.runsOnDevice ? "device_default" : "chosen",
    isProjectScoped,
  };
}

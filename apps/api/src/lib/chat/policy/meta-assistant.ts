import {
  type ConversationType,
  isMetaToolName,
  META_ASSISTANT_CONVERSATION_TYPE,
  META_TOOL_NAMES,
  type MetaAssistantUiContext,
} from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface MetaAssistantScope {
  uiContext?: MetaAssistantUiContext;
}

export function isMetaConversationType(type: ConversationType | undefined): boolean {
  return type === META_ASSISTANT_CONVERSATION_TYPE;
}

export function getMetaAssistantToolNames(): string[] {
  return [...META_TOOL_NAMES];
}

export function filterToolsForConversationType<T extends { name: string }>(
  tools: readonly T[],
  conversationType: ConversationType | undefined,
): T[] {
  const isMeta = isMetaConversationType(conversationType);

  return tools.filter((tool) => isMetaToolName(tool.name) === isMeta);
}

export async function resolveMetaAssistantScope(
  options: Pick<CoreChatOptions, "completion_id" | "meta_assistant" | "context">,
  repositories: Pick<RepositoryManager, "conversations">,
): Promise<MetaAssistantScope | null> {
  const requested = options.meta_assistant;
  const user = options.context?.user;
  const stored = options.completion_id
    ? await repositories.conversations.getConversation(options.completion_id)
    : null;
  const storedType = typeof stored?.type === "string" ? stored.type : undefined;
  const storedIsMeta = isMetaConversationType(storedType as ConversationType | undefined);

  if (!requested && !storedIsMeta) {
    return null;
  }

  if (!user?.id) {
    throw new AssistantError(
      "The meta assistant needs a signed-in user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (stored && stored.user_id !== user.id) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  if (requested && stored && !storedIsMeta) {
    throw new AssistantError(
      "This conversation is not a meta assistant conversation",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { uiContext: requested?.ui_context };
}

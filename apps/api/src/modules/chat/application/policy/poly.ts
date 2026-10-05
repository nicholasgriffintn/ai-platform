import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  type ConversationType,
  isPolyNavigationToolName,
  POLY_CONVERSATION_TYPE,
  POLY_NAVIGATION_TOOL_NAMES,
  type PolyUiContext,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { CoreChatOptions } from "~/types";

export interface PolyScope {
  uiContext?: PolyUiContext;
}

export function isPolyConversationType(type: ConversationType | undefined): boolean {
  return type === POLY_CONVERSATION_TYPE;
}

export function getPolyNavigationToolNames(): string[] {
  return [...POLY_NAVIGATION_TOOL_NAMES];
}

export function filterToolsForConversationType<T extends { name: string }>(
  tools: readonly T[],
  conversationType: ConversationType | undefined,
): T[] {
  const isMeta = isPolyConversationType(conversationType);

  return tools.filter((tool) => isPolyNavigationToolName(tool.name) === isMeta);
}

export async function resolvePolyScope(
  options: Pick<CoreChatOptions, "completion_id" | "poly" | "context">,
  repositories: Pick<RepositoryManager, "conversations">,
): Promise<PolyScope | null> {
  const requested = options.poly;
  const user = options.context?.user;
  const stored = options.completion_id
    ? await repositories.conversations.getConversation(options.completion_id)
    : null;
  const storedType = typeof stored?.type === "string" ? stored.type : undefined;
  const storedIsMeta = isPolyConversationType(storedType as ConversationType | undefined);

  if (!requested && !storedIsMeta) {
    return null;
  }

  if (!user?.id) {
    throw new AssistantError("Poly needs a signed-in user", ErrorType.AUTHENTICATION_ERROR, 401);
  }

  if (stored && !ownsResource(user.id, stored.user_id)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  if (requested && stored && !storedIsMeta) {
    throw new AssistantError(
      "This conversation is not a Poly conversation",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { uiContext: requested?.ui_context };
}

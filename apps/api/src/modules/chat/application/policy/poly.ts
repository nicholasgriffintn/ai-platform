import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  type ChatRunTrigger,
  type ConversationType,
  isPolyNavigationToolName,
  isPolyTeammateId,
  POLY_CONVERSATION_TYPE,
  POLY_NAVIGATION_TOOL_NAMES,
  type PolyUiContext,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { CoreChatOptions } from "~/types";

export interface PolyScope {
  uiContext?: PolyUiContext;
  navigation: boolean;
}

export interface PolyTurn {
  conversationType: ConversationType | undefined;
  trigger: ChatRunTrigger | undefined;
}

export function isPolyConversationType(type: ConversationType | undefined): boolean {
  return type === POLY_CONVERSATION_TYPE;
}

export function isPolyNavigationTurn(turn: PolyTurn): boolean {
  return isPolyConversationType(turn.conversationType) && (turn.trigger ?? "user") === "user";
}

export function getPolyNavigationToolNames(): string[] {
  return [...POLY_NAVIGATION_TOOL_NAMES];
}

export function filterToolsForPolyTurn<T extends { name: string }>(
  tools: readonly T[],
  turn: PolyTurn,
): T[] {
  const navigation = isPolyNavigationTurn(turn);

  return tools.filter((tool) => navigation || !isPolyNavigationToolName(tool.name));
}

export async function resolvePolyScope(
  options: Pick<
    CoreChatOptions,
    "completion_id" | "poly" | "context" | "resolved_configuration" | "trigger"
  >,
  repositories: Pick<RepositoryManager, "conversations">,
): Promise<PolyScope | null> {
  const requested = options.poly;
  const user = options.context?.user;
  const stored = options.completion_id
    ? await repositories.conversations.getConversation(options.completion_id)
    : null;
  const storedIsPoly = stored?.type === POLY_CONVERSATION_TYPE;

  if (!requested && !storedIsPoly) {
    return null;
  }

  if (!user?.id) {
    throw new AssistantError("Poly needs a signed-in user", ErrorType.AUTHENTICATION_ERROR, 401);
  }

  if (!stored || !storedIsPoly) {
    throw new AssistantError(
      "This conversation is not a Poly conversation",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!ownsResource(user.id, stored.user_id)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  const teammateId = options.resolved_configuration?.teammateId;

  if (typeof teammateId !== "string" || !isPolyTeammateId(teammateId)) {
    throw new AssistantError("Poly conversations only run as Poly", ErrorType.FORBIDDEN, 403);
  }

  return {
    uiContext: requested?.ui_context,
    navigation: isPolyNavigationTurn({
      conversationType: POLY_CONVERSATION_TYPE,
      trigger: options.trigger,
    }),
  };
}

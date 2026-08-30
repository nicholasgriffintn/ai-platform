import { findLockedTurnViolations } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ChatCompletionParameters, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface LockedTurnGuardInput {
  request: Partial<ChatCompletionParameters>;
  completionId: string;
  context: ServiceContext;
  user?: IUser;
}

export async function assertLockedTurnIsPermitted({
  request,
  completionId,
  context,
  user,
}: LockedTurnGuardInput): Promise<void> {
  if (!user?.id) {
    throw new AssistantError(
      "Locked conversations require an authenticated user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (user.plan_id !== "pro") {
    throw new AssistantError(
      "Locked conversations are available on Pro",
      ErrorType.AUTHENTICATION_ERROR,
      403,
    );
  }

  const violations = findLockedTurnViolations({
    approved_tools: request.approved_tools,
    background: request.background,
    compaction: request.compaction,
    enabled_tools: request.enabled_tools,
    models: request.models,
    options: request.options,
    rag_options: request.rag_options,
    store: request.store,
    tool_options: request.tool_options,
    use_multi_model: request.use_multi_model,
    use_rag: request.use_rag,
  });

  if (violations.length > 0) {
    throw new AssistantError(violations[0], ErrorType.PARAMS_ERROR, 400);
  }

  const conversation = await context.repositories.conversations.getConversation(completionId);

  if (!conversation || conversation.user_id !== user.id) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  if (!(await context.repositories.conversationLocks.isLocked(completionId))) {
    throw new AssistantError("This conversation is not locked", ErrorType.PARAMS_ERROR, 400);
  }
}

export function isLockedTurn(params: { locked?: boolean } | undefined): boolean {
  return params?.locked === true;
}

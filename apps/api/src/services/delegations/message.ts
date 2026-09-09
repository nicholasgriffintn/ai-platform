import { isLiveDelegationState } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { withThreadLockIfFree } from "~/services/conversations/coordinator/client";
import { conversationHandleIdForDelegation } from "~/utils/conversation-handles";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export async function deliverDelegationMessage(
  context: ServiceContext,
  delegationId: string,
  message: string,
  childConversationId?: string,
): Promise<boolean> {
  const user = context.requireUser();
  const delegation = await context.repositories.delegations.getById(delegationId);
  const handle = await context.repositories.conversationHandles.getUsableHandle(
    conversationHandleIdForDelegation(delegationId),
    delegationId,
    new Date().toISOString(),
  );

  if (
    !delegation ||
    !isLiveDelegationState(delegation.state) ||
    !handle ||
    (childConversationId !== undefined && delegation.childConversationId !== childConversationId)
  ) {
    throw new AssistantError(
      "This delegate has no usable parent handle.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (
    !(await context.repositories.workspaces.canAccessConversation(handle.conversationId, user.id))
  ) {
    throw new AssistantError(
      "The parent conversation is no longer accessible.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return withThreadLockIfFree(
    { env: context.env, conversationId: handle.conversationId, kind: "user_message" },
    async (lease) => {
      await lease.assertOwned();
      await context.repositories.messages.createMessage(
        generateId(),
        handle.conversationId,
        "assistant",
        message,
        {
          data: {
            trigger: "handle",
            delegationId: delegation.id,
            teammateId: delegation.teammateId,
          },
          provenance: {
            site: "hosted",
            model: "delegation",
            vendor: delegation.teammateId,
          },
        },
      );
      await context.repositories.conversations.markUnreadForUser(handle.conversationId, user.id);

      return true;
    },
  );
}

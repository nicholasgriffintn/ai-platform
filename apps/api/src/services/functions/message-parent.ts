import z from "zod/v4";

import { withThreadLockIfFree } from "~/services/conversations/coordinator/client";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { messageParent as messageParentDescriptor } from "./definitions/message-parent";

export const messageParent: ApiToolDefinition = {
  ...messageParentDescriptor,
  execute: async (args, toolContext): Promise<IFunctionResponse> => {
    const context = toolContext.request.context;
    const user = toolContext.request.user;
    const delegationContext = toolContext.request.request?.delegation_context;

    if (!context || !user?.id || !delegationContext) {
      throw new AssistantError(
        "Only a running delegate can message its parent conversation.",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const delegation = await context.repositories.delegations.getById(
      delegationContext.delegationId,
    );
    const handleId = `handle_${delegationContext.delegationId}`;
    const handle = await context.repositories.conversationHandles.getUsableHandle(
      handleId,
      delegationContext.delegationId,
      new Date().toISOString(),
    );

    if (!delegation || delegation.childConversationId !== toolContext.completionId || !handle) {
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

    const delivered = await withThreadLockIfFree(
      { env: context.env, conversationId: handle.conversationId, kind: "user_message" },
      async (lease) => {
        await lease.assertOwned();
        await context.repositories.messages.createMessage(
          generateId(),
          handle.conversationId,
          "assistant",
          args.message,
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

    if (!delivered) {
      return {
        status: "error",
        name: "message_parent",
        content: "The parent conversation is busy. Try again after its current turn finishes.",
      };
    }

    return {
      status: "success",
      name: "message_parent",
      content: "Message delivered to the parent conversation.",
    };
  },
};

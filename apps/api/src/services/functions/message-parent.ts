import { DELEGATION_MESSAGE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { TaskService } from "~/services/tasks/TaskService";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { deliverDelegationMessage } from "../delegations/message";
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

    if (!delegation || delegation.childConversationId !== toolContext.completionId) {
      throw new AssistantError(
        "This delegate has no usable parent handle.",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    const delivered = await deliverDelegationMessage(
      context,
      delegation.id,
      args.message,
      toolContext.completionId,
    );

    if (!delivered) {
      await new TaskService(context.env, context.repositories.tasks).enqueueTask({
        id: `delegation_message_${delegation.id}_${generateId()}`,
        task_type: DELEGATION_MESSAGE_TASK_TYPE,
        user_id: user.id,
        project_id: undefined,
        priority: 4,
        task_data: { delegationId: delegation.id, message: args.message },
      });
      return {
        status: "success",
        name: "message_parent",
        content: "The parent conversation is busy. The message is queued for delivery.",
      };
    }

    return {
      status: "success",
      name: "message_parent",
      content: "Message delivered to the parent conversation.",
    };
  },
};

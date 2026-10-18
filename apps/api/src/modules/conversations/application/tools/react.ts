import {
  REACT_TOOL_NAME,
  ToolResponseType,
  type ReactToolInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ConversationManager } from "~/modules/conversations/application/manager";
import {
  readReactionTarget,
  writeItemReaction,
} from "~/modules/conversations/application/reactions";
import type { IFunctionResponse, Message } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { react as reactDescriptor } from "./definitions/react";

function latestPersonMessage(messages: readonly Message[]): Message | undefined {
  return [...messages].reverse().find((message) => message.role === "user" && Boolean(message.id));
}

export const react: ApiToolDefinition = {
  ...reactDescriptor,
  execute: async (args: ReactToolInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const user = request.user;
    const conversationId = toolContext.completionId;

    if (!context || !user?.id || !conversationId) {
      throw new AssistantError(
        "Reacting needs a signed-in user and a conversation",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const manager = ConversationManager.getInstance({ repositories: context.repositories, user });
    const itemId =
      args.item_id ?? latestPersonMessage(await manager.get(conversationId))?.id ?? undefined;

    if (!itemId) {
      throw new AssistantError("There is no message to react to", ErrorType.NOT_FOUND, 404);
    }

    const target = await readReactionTarget(manager, conversationId, itemId);
    const reactions = await writeItemReaction({
      env: context.env,
      repositories: context.repositories,
      target,
      actor: "teammate",
      actorId: request.request?.teammate_context_id ?? "assistant",
      emoji: args.emoji,
      remove: args.remove,
    });

    return {
      status: "success",
      name: REACT_TOOL_NAME,
      content: args.remove ? `Removed ${args.emoji}.` : `Reacted ${args.emoji}.`,
      data: { responseType: ToolResponseType.HIDDEN, itemId, reactions },
    } satisfies IFunctionResponse;
  },
};

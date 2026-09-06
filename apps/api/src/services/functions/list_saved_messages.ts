import {
  SAVED_MESSAGES_TOOL_NAME,
  type ListSavedMessagesInput,
} from "@ngriffin_uk/polychat-schemas";

import { listSavedMessages } from "~/services/saved-messages";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { list_saved_messages as listSavedMessagesDescriptor } from "./definitions/list_saved_messages";

const DEFAULT_LIMIT = 10;

export const list_saved_messages: ApiToolDefinition = {
  ...listSavedMessagesDescriptor,
  execute: async (args: ListSavedMessagesInput, toolContext) => {
    const request = toolContext.request;

    if (!request.context || !request.user?.id) {
      throw new AssistantError(
        "Reading saved messages needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const { messages } = await listSavedMessages(request.context, args.limit ?? DEFAULT_LIMIT);

    if (messages.length === 0) {
      return {
        status: "success",
        name: SAVED_MESSAGES_TOOL_NAME,
        content: "The user has not saved anything for later.",
        data: { messages },
      } satisfies IFunctionResponse;
    }

    const lines = messages.map(
      (message) =>
        `- ${message.conversationTitle ?? "Untitled conversation"}: ${message.excerpt}${
          message.note ? ` (note: ${message.note})` : ""
        }`,
    );

    return {
      status: "success",
      name: SAVED_MESSAGES_TOOL_NAME,
      content: `Saved for later:\n${lines.join("\n")}`,
      data: { messages },
    } satisfies IFunctionResponse;
  },
};

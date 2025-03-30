import { ConversationManager } from "../../lib/conversationManager";
import { Database } from "../../lib/database";
import type { IRequest, Message } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

export const handleReplicateWebhook = async (
  req: IRequest,
  id: string,
): Promise<Message[]> => {
  const { env, request } = req;

  if (!env.DB) {
    throw new AssistantError("Missing DB binding", ErrorType.PARAMS_ERROR);
  }

  if (!request) {
    throw new AssistantError("Missing request", ErrorType.PARAMS_ERROR);
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    model: "replicate",
    platform: "api",
  });

  const item = await conversationManager.getFromWebhook(id);

  if (!item?.length) {
    throw new AssistantError("Item not found", ErrorType.PARAMS_ERROR);
  }

  const matchingMessage = item.find(
    (message) => message?.data?.id === request?.id,
  );

  if (!matchingMessage) {
    throw new AssistantError(
      `Message from ${id} with item id ${request?.id} not found`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const updatedMessage = {
    ...matchingMessage,
    data: {
      ...matchingMessage.data,
      ...request,
    },
  };

  const messages = item.map((message) => {
    if (message?.data?.id === request?.id) {
      return updatedMessage;
    }

    return message;
  });

  await conversationManager.updateFromWebhook(id, messages);

  return item;
};

import { gatewayId } from "../../constants/app";
import { ConversationManager } from "../../lib/conversationManager";
import { Database } from "../../lib/database";
import type { IRequest, Message } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

export const handleGenerateChatCompletionTitle = async (
  req: IRequest,
  completion_id: string,
  messages?: Message[],
  store?: boolean,
): Promise<{ title: string }> => {
  const { env, user } = req;

  if (!env.AI) {
    throw new Error("AI binding is not available");
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing DB binding",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (!user || !user.id) {
    throw new AssistantError(
      "Authentication required",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user.id,
    store,
  });

  try {
    await conversationManager.get(completion_id);
  } catch (error) {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }

  let messagesToUse: Message[] = [];

  if (messages && messages.length > 0) {
    messagesToUse = messages.slice(0, Math.min(3, messages.length));
  } else {
    const conversationMessages = await conversationManager.get(completion_id);

    if (conversationMessages.length === 0) {
      return { title: "New Conversation" };
    }

    messagesToUse = conversationMessages.map((msg) => ({
      role: msg.role as any,
      content: msg.content as string,
    }));
  }

  const prompt = `You are a title generator. Your only job is to create a short, concise title (maximum 5 words) for a conversation.
    Do not include any explanations, prefixes, or quotes in your response.
    Output only the title itself.
    
    Conversation:
    ${messagesToUse
      .map(
        (msg) =>
          `${msg.role.toUpperCase()}: ${typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}`,
      )
      .join("\n")}
  `;

  const response = await env.AI.run(
    "@cf/meta/llama-3-8b-instruct",
    {
      prompt,
      max_tokens: 10,
    },
    {
      gateway: {
        id: gatewayId,
        skipCache: false,
        cacheTtl: 3360,
        authorization: env.AI_GATEWAY_TOKEN,
        metadata: {
          email: user?.email || "anonymous@undefined.computer",
        },
      },
    },
  );

  // @ts-expect-error
  let newTitle = response.response.trim();

  if (
    (newTitle.startsWith('"') && newTitle.endsWith('"')) ||
    (newTitle.startsWith("'") && newTitle.endsWith("'"))
  ) {
    newTitle = newTitle.slice(1, -1);
  }

  if (newTitle.length > 50) {
    newTitle = `${newTitle.substring(0, 47)}...`;
  }

  if (!newTitle) {
    newTitle = "New Conversation";
  }

  await conversationManager.updateConversation(completion_id, {
    title: newTitle,
  });

  return { title: newTitle };
};

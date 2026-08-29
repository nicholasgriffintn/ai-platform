import { DEFAULT_CONVERSATION_TITLE } from "@ngriffin_uk/polychat-schemas";

import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { sanitiseMessages } from "~/lib/chat/messages/sanitise";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { createInitialConversationTitle } from "~/lib/conversation/title-source";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { stripSurroundingQuotes } from "~/utils/strings";

const TITLE_MAX_MESSAGES = 3;
const TITLE_MAX_LENGTH = 50;

function buildTitlePrompt(messages: { role: string; content: unknown }[]): string {
  return `You are a title generator. Your only job is to create a short, concise title (maximum 5 words) for a conversation.
    Do not include any explanations, prefixes, or quotes in your response.
    Output only the title itself.

    Conversation:
    ${messages
      .map(
        (msg) =>
          `${msg.role.toUpperCase()}: ${typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}`,
      )
      .join("\n")}
  `;
}

export async function generateConversationTitle(
  context: ServiceContext,
  messages: Message[],
): Promise<string> {
  const runtimeEnv = context.env;

  if (!runtimeEnv.AI) {
    throw new AssistantError("AI binding is not available", ErrorType.CONFIGURATION_ERROR);
  }

  const user = context.requireUser();
  const messagesToUse = toProviderMessages(sanitiseMessages(messages))
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(0, TITLE_MAX_MESSAGES);

  if (!messagesToUse.length) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(runtimeEnv, user);
  const provider = getChatProvider(providerToUse, { env: runtimeEnv, user });
  const response: any = await provider.getResponse({
    env: runtimeEnv,
    context,
    model: modelToUse,
    provider: providerToUse,
    messages: [{ role: "user", content: buildTitlePrompt(messagesToUse) }],
  });

  const title = stripSurroundingQuotes(
    typeof response?.response === "string" ? response.response : "",
  );

  if (!title) {
    return createInitialConversationTitle(messages);
  }

  return title.length > TITLE_MAX_LENGTH ? `${title.substring(0, TITLE_MAX_LENGTH - 3)}...` : title;
}

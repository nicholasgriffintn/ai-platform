import { buildConversationTitlePrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { DEFAULT_CONVERSATION_TITLE } from "@ngriffin_uk/polychat-schemas";
import { stripSurroundingQuotes } from "@ngriffin_uk/polychat-utility-server/strings";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { sanitiseMessages } from "~/modules/chat/application/messages/sanitise";
import { createInitialConversationTitle } from "~/modules/conversations/application/title-source";
import { getTitlingModel } from "~/modules/models/application/resolve";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/conversations/title-generation" });

const TITLE_MAX_MESSAGES = 3;
const TITLE_MAX_LENGTH = 50;
const TITLE_MAX_OUTPUT_TOKENS = 64;

export async function generateConversationTitle(
  context: ServiceContext,
  messages: Message[],
): Promise<string> {
  const runtimeEnv = context.env;
  const user = context.requireUser();
  const messagesToUse = toProviderMessages(sanitiseMessages(messages))
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(0, TITLE_MAX_MESSAGES);

  if (!messagesToUse.length) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const { model: modelToUse, provider: providerToUse } = await getTitlingModel(runtimeEnv, user);

  try {
    const title = stripSurroundingQuotes(
      await ai.generateText({
        env: runtimeEnv,
        user,
        model: modelToUse,
        provider: providerToUse,
        prompt: buildConversationTitlePrompt({ messages: messagesToUse }),
        max_tokens: TITLE_MAX_OUTPUT_TOKENS,
      }),
    );

    if (!title) {
      return createInitialConversationTitle(messages);
    }

    return title.length > TITLE_MAX_LENGTH
      ? `${title.substring(0, TITLE_MAX_LENGTH - 3)}...`
      : title;
  } catch (error) {
    logger.warn("Titling model failed, falling back to excerpt", {
      error,
      model: modelToUse,
      provider: providerToUse,
    });

    return createInitialConversationTitle(messages);
  }
}

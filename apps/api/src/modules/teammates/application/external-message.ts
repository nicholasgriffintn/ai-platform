import { extractChatCompletionNotification } from "@ngriffin_uk/polychat-ai-providers";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { ensureTeammateContext } from "./contexts";
import { enqueueTeammateRun } from "./run-admission";

const WORKING_MESSAGE = "The teammate is working on it and will reply in Polychat.";

export interface ExternalTeammateReply {
  text: string;
  conversationId: string;
}

export async function messageTeammateFromOutside(
  context: ServiceContext,
  teammateId: string,
  message: string,
): Promise<ExternalTeammateReply> {
  const user = context.requireUser();
  const teammateContext = await ensureTeammateContext(context, teammateId, {
    type: "personal",
    id: String(user.id),
  });
  const response = await enqueueTeammateRun({
    env: context.env,
    context,
    body: {
      conversationId: teammateContext.homeConversationId,
      messages: [{ role: "user", content: message }],
      stream: false,
      store: true,
    },
    teammateId,
    user,
    anonymousUser: undefined,
    authority: { trigger: "channel" },
  });
  const notification = extractChatCompletionNotification(response, {
    streamingMessage: WORKING_MESSAGE,
    fallback: WORKING_MESSAGE,
  });

  return { text: notification.body, conversationId: teammateContext.homeConversationId };
}

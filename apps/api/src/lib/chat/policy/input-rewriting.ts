import type { ChatInputPolicy, ChatInputPolicyPreview } from "@ngriffin_uk/polychat-schemas";

import { estimateTextTokens } from "~/lib/messageTokens";
import { getChatInputPolicy } from "~/services/chat-input-policy";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { ChatCompletionParameters, Message } from "~/types";
import { compactJsonWhitespace } from "~/utils/json";
import { getLogger } from "~/utils/logger";

export function previewInputRewrite(
  policy: ChatInputPolicy,
  content: string,
): ChatInputPolicyPreview {
  const rewritten =
    policy.toolOutputRewriting === "compact_json" ? compactJsonWhitespace(content) : content;

  return {
    content: rewritten,
    changed: rewritten !== content,
    originalCharacters: content.length,
    rewrittenCharacters: rewritten.length,
    estimatedTokensSaved: Math.max(0, estimateTextTokens(content) - estimateTextTokens(rewritten)),
  };
}

function rewriteToolMessage(message: Message): Message {
  if (
    message.role !== "tool" ||
    typeof message.content !== "string" ||
    (message.status && message.status !== "completed" && message.status !== "success")
  ) {
    return message;
  }

  const hasOtherPayload = message.parts?.some((part) => {
    if (part.type === "text") {
      return part.text !== message.content;
    }

    return (
      part.type !== "tool_result" ||
      part.content !== message.content ||
      part.toolCallId !== message.tool_call_id ||
      (part.status && part.status !== "completed" && part.status !== "success")
    );
  });

  if (hasOtherPayload) {
    return message;
  }

  const content = compactJsonWhitespace(message.content);

  if (content === message.content) {
    return message;
  }

  return {
    ...message,
    content,
    ...(message.parts
      ? {
          parts: message.parts.map((part) =>
            part.type === "text" ? { ...part, text: content } : { ...part, content },
          ),
        }
      : {}),
  };
}

export function rewriteToolMessages(messages: Message[], policy: ChatInputPolicy): Message[] {
  return policy.toolOutputRewriting === "off" ? messages : messages.map(rewriteToolMessage);
}

export async function rewriteChatInput(
  request: Pick<ChatCompletionParameters, "messages" | "completion_id" | "metadata" | "context">,
): Promise<Message[]> {
  const messages = request.messages ?? [];

  if (!request.context?.user) {
    return messages;
  }

  const access = await resolveChatProjectAccess(request.context, request);
  const state = await getChatInputPolicy(request.context, access?.project.id);

  const rewritten = rewriteToolMessages(messages, state.policy);
  const changedMessages = rewritten.filter((message, index) => message !== messages[index]).length;

  if (changedMessages > 0) {
    getLogger({ prefix: "chat/input-rewriting" }).info("Applied chat input policy", {
      revision: state.revision,
      toolOutputRewriting: state.policy.toolOutputRewriting,
      changedMessages,
    });
  }

  return rewritten;
}

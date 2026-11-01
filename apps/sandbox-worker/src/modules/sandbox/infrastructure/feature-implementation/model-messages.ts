import type { AgentMessage, AgentToolCall } from "@ngriffin_uk/polychat-ai-agents";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { PolychatChatMessage, PolychatFunctionToolCall } from "../polychat-client";

function contentText(content: AgentMessage["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function readFunctionToolCall(value: unknown): PolychatFunctionToolCall | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isRecord(value.function)) {
    return null;
  }

  const { name, arguments: args } = value.function;

  return typeof name === "string" && typeof args === "string"
    ? { id: value.id, type: "function", function: { name, arguments: args } }
    : null;
}

export function toAssistantMessage(
  content: string,
  toolCalls: readonly AgentToolCall[],
): AgentMessage {
  if (toolCalls.length === 0) {
    return { role: "assistant", content };
  }

  return {
    role: "assistant",
    content,
    tool_calls: toolCalls.map((toolCall): PolychatFunctionToolCall => ({
      id: toolCall.id,
      type: "function",
      function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
    })),
  };
}

export function toToolResultMessage(
  toolCall: AgentToolCall,
  observations: readonly string[],
): AgentMessage {
  return {
    role: "tool",
    name: toolCall.name,
    tool_call_id: toolCall.id,
    content: observations.join("\n\n") || "The tool produced no output.",
  };
}

export function toPolychatMessages(messages: readonly AgentMessage[]): PolychatChatMessage[] {
  const answeredToolCallIds = new Set(
    messages.flatMap((message) =>
      message.role === "tool" && message.tool_call_id ? [message.tool_call_id] : [],
    ),
  );

  return messages.map((message): PolychatChatMessage => {
    const content = contentText(message.content);

    if (message.role === "tool") {
      return { role: "tool", content, name: message.name, tool_call_id: message.tool_call_id };
    }

    const toolCalls = (message.tool_calls ?? []).flatMap((value) => {
      const toolCall = readFunctionToolCall(value);

      return toolCall ? [toolCall] : [];
    });
    const answered = toolCalls.filter((toolCall) => answeredToolCallIds.has(toolCall.id));
    const unanswered = toolCalls.filter((toolCall) => !answeredToolCallIds.has(toolCall.id));

    return {
      role: message.role,
      content: unanswered.length
        ? [content, JSON.stringify(unanswered)].filter(Boolean).join("\n")
        : content,
      ...(answered.length ? { tool_calls: answered } : {}),
    };
  });
}

import {
  parseToolCallArguments,
  type AgentMessage,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";

import { normaliseMessageParts } from "~/lib/chat/messages/parts";
import type { Message, MessageContent } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { extractTextFromMessageContent } from "~/utils/messages";
import { isPlainObject } from "~/utils/objects";

const CHAT_ROLES = new Set(["user", "assistant", "tool", "developer", "system"]);

export interface AgentModelToolCall {
  id?: string;
  name?: string;
  arguments?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface AgentModelResponse {
  response?: string;
  thinking?: string;
  parts?: Message["parts"];
  tool_calls?: AgentModelToolCall[];
  citations?: string[] | null;
  data?: unknown;
  log_id?: string;
  usage?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
  status?: string;
  refusal?: string | null;
  annotations?: unknown;
}

export interface AgentProviderIOOptions {
  createId?: () => string;
}

type AgentRuntimeMessage = AgentMessage & {
  name?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  tool_call_arguments?: unknown;
  status?: unknown;
};

class AgentProviderIO {
  private readonly createId: () => string;

  constructor(options: AgentProviderIOOptions = {}) {
    this.createId = options.createId ?? generateId;
  }

  initialMessages(messages: unknown): AgentMessage[] {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AssistantError("Agent mode requires at least one message", ErrorType.PARAMS_ERROR);
    }

    return messages.map((message) => {
      if (!this.isChatMessage(message)) {
        throw new AssistantError(
          "Agent mode received invalid message format",
          ErrorType.PARAMS_ERROR,
        );
      }

      return message;
    });
  }

  providerMessages(messages: AgentRuntimeMessage[]): Message[] {
    return messages.map((message) => {
      const providerMessage: Message = {
        role: message.role,
        content: this.providerContent(message.content),
      };

      if (typeof message.name === "string") {
        providerMessage.name = message.name;
      }

      if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
        providerMessage.tool_calls = message.tool_calls.filter((toolCall) =>
          isPlainObject(toolCall),
        );
      }

      if (typeof message.tool_call_id === "string") {
        providerMessage.tool_call_id = message.tool_call_id;
      }

      if (
        typeof message.tool_call_arguments === "string" ||
        isPlainObject(message.tool_call_arguments)
      ) {
        providerMessage.tool_call_arguments = message.tool_call_arguments;
      }

      if (typeof message.status === "string") {
        providerMessage.status = message.status;
      }

      return providerMessage;
    });
  }

  modelResponse(value: unknown): AgentModelResponse {
    if (!isPlainObject(value)) {
      throw new AssistantError(
        "Provider returned an invalid response shape",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const toolCalls = Array.isArray(value.tool_calls)
      ? value.tool_calls.filter((toolCall): toolCall is AgentModelToolCall =>
          this.isModelToolCall(toolCall),
        )
      : undefined;

    const citations = Array.isArray(value.citations)
      ? value.citations.filter((citation): citation is string => typeof citation === "string")
      : undefined;

    return {
      response: resolveModelResponseText(value.response),
      thinking: typeof value.thinking === "string" ? value.thinking : undefined,
      parts: normaliseMessageParts(value.parts),
      tool_calls: toolCalls,
      citations,
      data: value.data,
      log_id: typeof value.log_id === "string" ? value.log_id : undefined,
      usage: isPlainObject(value.usage) ? value.usage : undefined,
      usageMetadata: isPlainObject(value.usageMetadata) ? value.usageMetadata : undefined,
      status: typeof value.status === "string" ? value.status : undefined,
      refusal:
        typeof value.refusal === "string"
          ? value.refusal
          : value.refusal === null
            ? null
            : undefined,
      annotations: value.annotations,
    };
  }

  agentToolCalls(toolCalls: AgentModelToolCall[]): AgentToolCall[] {
    return toolCalls.map((toolCall) => ({
      id: toolCall.id || this.createId(),
      name: toolCall.function?.name || toolCall.name || "unknown",
      arguments: parseToolCallArguments(toolCall.function?.arguments ?? toolCall.arguments),
      raw: toolCall,
    }));
  }

  providerToolCalls(toolCalls: AgentToolCall[]): Record<string, unknown>[] {
    return toolCalls.map((toolCall) => {
      if (isPlainObject(toolCall.raw)) {
        if (typeof toolCall.raw.id === "string" && toolCall.raw.id.length > 0) {
          return toolCall.raw;
        }

        return {
          ...toolCall.raw,
          id: toolCall.id,
        };
      }

      return {
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      };
    });
  }

  private isChatMessage(value: unknown): value is AgentMessage {
    if (!isPlainObject(value)) {
      return false;
    }

    if (!CHAT_ROLES.has(String(value.role))) {
      return false;
    }

    return "content" in value;
  }

  private providerContent(content: AgentMessage["content"]): Message["content"] {
    if (typeof content === "string") {
      return content;
    }

    if (content === null) {
      return "";
    }

    if (Array.isArray(content)) {
      return this.isMessageContentArray(content) ? content : JSON.stringify(content);
    }

    return content;
  }

  private isMessageContentArray(value: unknown[]): value is MessageContent[] {
    return value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "type" in entry &&
        typeof (entry as { type?: unknown }).type === "string",
    );
  }

  private isModelToolCall(value: unknown): value is AgentModelToolCall {
    if (!isPlainObject(value)) {
      return false;
    }

    if ("function" in value) {
      return isPlainObject(value.function);
    }

    return true;
  }
}

function resolveModelResponseText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  return extractTextFromMessageContent(value) || undefined;
}

export function createAgentProviderIO(options?: AgentProviderIOOptions): AgentProviderIO {
  return new AgentProviderIO(options);
}

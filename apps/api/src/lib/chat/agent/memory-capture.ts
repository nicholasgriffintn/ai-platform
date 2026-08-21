import { MEMORY_STORE_TOOL_NAME } from "~/lib/chat/policy/memory";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { MemoryManager, type MemoryEvent } from "~/lib/memory";
import type { IEnv, IUserSettings, MemoryScope, Message, Platform, ToolCall } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { hasToolCallNamed } from "~/utils/toolCalls";

const logger = getLogger({ prefix: "lib/chat/agent/memory-capture" });

export interface CaptureRunMemoriesParams {
  env: IEnv;
  completionId: string;
  conversationManager: ConversationManager;
  context?: ServiceContext;
  userSettings?: IUserSettings;
  memoryScope: MemoryScope;
  model: string;
  platform: Platform;
  toolCalls: readonly ToolCall[];
}

export async function captureRunMemories(params: CaptureRunMemoriesParams): Promise<Message[]> {
  const user = params.context?.user;
  const memoriesEnabled =
    params.userSettings?.memories_save_enabled ||
    params.userSettings?.memories_chat_history_enabled;

  if (
    !user?.id ||
    user.plan_id !== "pro" ||
    !memoriesEnabled ||
    hasToolCallNamed(params.toolCalls, MEMORY_STORE_TOOL_NAME)
  ) {
    return [];
  }

  try {
    const history = await params.conversationManager.get(params.completionId);
    const lastUserText = getLastUserText(history);

    if (!lastUserText.trim()) {
      return [];
    }

    const memoryManager = MemoryManager.getInstance(
      params.env,
      user,
      params.context,
      params.memoryScope,
    );
    const events = await memoryManager.handleMemory(
      lastUserText,
      history,
      params.conversationManager,
      params.completionId,
      params.userSettings,
    );
    const messages = events.map((event) => buildMemoryMessage(event, params));

    for (const message of messages) {
      await params.conversationManager.add(params.completionId, message);
    }

    return messages;
  } catch (error) {
    logger.error("Failed to process memory for chat", {
      error,
      completion_id: params.completionId,
    });

    return [];
  }
}

function buildMemoryMessage(event: MemoryEvent, params: CaptureRunMemoriesParams): Message {
  return {
    role: "tool",
    name: "memory",
    content:
      event.type === "store"
        ? `📝 Stored ${event.category} memory: ${event.text}`
        : "🔍 Created memory snapshot",
    status: "success",
    data: { type: event.type, category: event.category, text: event.text },
    id: generateId(),
    timestamp: Date.now(),
    log_id: params.env.AI?.aiGatewayLogId || "",
    model: params.model,
    platform: params.platform,
  };
}

function getLastUserText(history: readonly { role: string; content: unknown }[]): string {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];

    if (message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return (
        (
          message.content.find((block) => (block as { type?: string }).type === "text") as
            | { text?: string }
            | undefined
        )?.text ?? ""
      );
    }

    return "";
  }

  return "";
}

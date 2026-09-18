import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { hasToolCallNamed } from "@ngriffin_uk/polychat-utility-server/tool-calls";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  MEMORY_STORE_TOOL_NAME,
  resolveMemoryPolicy,
} from "~/modules/chat/application/policy/memory";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import { MemoryManager, type MemoryEvent } from "~/modules/memory/application/manager";
import type { IEnv, IUserSettings, MemoryScope, Message, Platform, ToolCall } from "~/types";

const logger = getLogger({ prefix: "services/chat/agent/memory-capture" });

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
  trustedUserInput: boolean;
  store: boolean;
}

export async function captureRunMemories(params: CaptureRunMemoriesParams): Promise<Message[]> {
  const user = params.context?.user;
  const memoryPolicy = resolveMemoryPolicy({
    user,
    userSettings: params.userSettings,
    store: params.store,
  });

  if (
    !user?.id ||
    !params.trustedUserInput ||
    !memoryPolicy.enabled ||
    (params.memoryScope.type === "bound" && params.memoryScope.documents.length === 0) ||
    hasToolCallNamed(params.toolCalls, MEMORY_STORE_TOOL_NAME)
  ) {
    return [];
  }

  try {
    const history = await params.conversationManager.get(params.completionId);
    const lastUser = getLastUser(history);

    if (!lastUser?.text.trim()) {
      return [];
    }

    const memoryManager = MemoryManager.getInstance(
      params.env,
      user,
      params.context,
      params.memoryScope,
    );
    const events = await memoryManager.handleMemory(
      lastUser.text,
      history,
      params.conversationManager,
      params.completionId,
      params.userSettings,
      `memory-capture:${params.completionId}:${lastUser.identity}`,
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

function getLastUser(
  history: readonly { id?: string; role: string; content: unknown }[],
): { identity: string; text: string } | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];

    if (message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      return { identity: message.id ?? `user-${index}`, text: message.content };
    }

    if (Array.isArray(message.content)) {
      const text =
        (
          message.content.find((block) => (block as { type?: string }).type === "text") as
            | { text?: string }
            | undefined
        )?.text ?? "";

      return { identity: message.id ?? `user-${index}`, text };
    }

    return { identity: message.id ?? `user-${index}`, text: "" };
  }

  return null;
}

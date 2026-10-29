import type {
  CreateMemoryImportInput,
  MemoryImportConversation,
} from "@ngriffin_uk/polychat-schemas";
import { strFromU8, unzipSync } from "fflate";
import { z } from "zod/v4";

export type AssistantExport = Extract<CreateMemoryImportInput, { kind: "conversations" }>;

const chatGptNodeSchema = z.object({
  parent: z.string().nullable().optional(),
  message: z
    .object({
      author: z.object({ role: z.string() }),
      create_time: z.number().nullable().optional(),
      content: z.object({
        content_type: z.string(),
        parts: z.array(z.unknown()).optional(),
        user_profile: z.string().nullable().optional(),
        user_instructions: z.string().nullable().optional(),
      }),
    })
    .nullable()
    .optional(),
});

const chatGptConversationSchema = z.object({
  title: z.string().nullable().optional(),
  create_time: z.number().nullable().optional(),
  current_node: z.string().nullable().optional(),
  mapping: z.record(z.string(), chatGptNodeSchema),
});

const claudeConversationSchema = z.object({
  name: z.string().nullable().optional(),
  created_at: z.string().optional(),
  chat_messages: z.array(
    z.object({
      sender: z.string(),
      text: z.string().nullable().optional(),
      created_at: z.string().optional(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().nullable().optional() }))
        .optional(),
    }),
  ),
});

type ChatGptNode = z.infer<typeof chatGptNodeSchema>;
type ChatGptConversation = z.infer<typeof chatGptConversationSchema>;
type ClaudeConversation = z.infer<typeof claudeConversationSchema>;

function isoFromSeconds(seconds: number | null | undefined): string | undefined {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : undefined;
}

function chatGptThread(conversation: ChatGptConversation): ChatGptNode[] {
  const thread: ChatGptNode[] = [];
  const seen = new Set<string>();
  let nodeId = conversation.current_node ?? null;

  while (nodeId && !seen.has(nodeId) && conversation.mapping[nodeId]) {
    seen.add(nodeId);
    thread.unshift(conversation.mapping[nodeId]);
    nodeId = conversation.mapping[nodeId].parent ?? null;
  }

  return thread.length > 0 ? thread : Object.values(conversation.mapping);
}

function chatGptUserText(node: ChatGptNode): string {
  const message = node.message;

  if (message?.author.role !== "user") {
    return "";
  }

  if (message.content.content_type === "user_editable_context") {
    return [message.content.user_profile, message.content.user_instructions]
      .filter((part): part is string => Boolean(part?.trim()))
      .join("\n\n");
  }

  return (message.content.parts ?? [])
    .filter((part): part is string => typeof part === "string")
    .join("\n");
}

function fromChatGpt(conversation: ChatGptConversation): MemoryImportConversation {
  return {
    title: conversation.title ?? "",
    ...(isoFromSeconds(conversation.create_time)
      ? { createdAt: isoFromSeconds(conversation.create_time) }
      : {}),
    messages: chatGptThread(conversation).flatMap((node) => {
      const text = chatGptUserText(node).trim();
      const createdAt = isoFromSeconds(node.message?.create_time);

      return text ? [{ text, ...(createdAt ? { createdAt } : {}) }] : [];
    }),
  };
}

function fromClaude(conversation: ClaudeConversation): MemoryImportConversation {
  return {
    title: conversation.name ?? "",
    ...(conversation.created_at ? { createdAt: conversation.created_at } : {}),
    messages: conversation.chat_messages.flatMap((message) => {
      if (message.sender !== "human") {
        return [];
      }

      const text = (
        message.text?.trim() ||
        (message.content ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n")
      ).trim();

      return text
        ? [{ text, ...(message.created_at ? { createdAt: message.created_at } : {}) }]
        : [];
    }),
  };
}

function withoutRepeats(conversations: MemoryImportConversation[]): MemoryImportConversation[] {
  const seen = new Set<string>();

  return conversations.flatMap((conversation) => {
    const messages = conversation.messages.filter((message) => {
      if (seen.has(message.text)) {
        return false;
      }

      seen.add(message.text);

      return true;
    });

    return messages.length > 0 ? [{ ...conversation, messages }] : [];
  });
}

function parseEach<T>(items: unknown[], schema: z.ZodType<T>): T[] {
  return items.flatMap((item) => {
    const parsed = schema.safeParse(item);

    return parsed.success ? [parsed.data] : [];
  });
}

function exportItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "object" && value !== null ? [value] : [];
}

export function parseAssistantExport(values: readonly unknown[]): AssistantExport | null {
  const items = values.flatMap(exportItems);
  const chatGpt = parseEach(items, chatGptConversationSchema);

  if (chatGpt.length > 0) {
    const conversations = withoutRepeats(chatGpt.map(fromChatGpt));

    return conversations.length > 0
      ? { kind: "conversations", source: "chatgpt", conversations }
      : null;
  }

  const claude = parseEach(items, claudeConversationSchema);
  const conversations = withoutRepeats(claude.map(fromClaude));

  return conversations.length > 0
    ? { kind: "conversations", source: "claude", conversations }
    : null;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readJsonValues(file: Blob & { name: string }): Promise<unknown[]> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return [parseJsonText(await file.text())];
  }

  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => entry.name.toLowerCase().endsWith(".json"),
  });

  return Object.values(entries).map((entry) => parseJsonText(strFromU8(entry)));
}

export async function readAssistantExport(
  files: readonly (Blob & { name: string })[],
): Promise<AssistantExport | null> {
  const values = await Promise.all(files.map(readJsonValues));

  return parseAssistantExport(values.flat());
}

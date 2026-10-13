import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { messagePartSchema, messagePartsSchema, type MessagePart } from "../message-parts.js";
import { chatMessageContentPartSchema, connectorApprovalIdSchema } from "../response-command.js";
import type { MessageRole } from "../shared.js";

const recordSchema = z.record(z.string(), z.unknown());

export const inputContentPartSchema = chatMessageContentPartSchema;

export const contentPartSchema = z.union([messagePartSchema, inputContentPartSchema]);

export type ContentPart = z.infer<typeof contentPartSchema>;

export const itemRoleSchema = z.enum(["user", "assistant", "system", "developer"]);

export type ItemRole = z.infer<typeof itemRoleSchema>;

const itemBaseFields = {
  id: z.string().min(1).optional(),
  status: z.string().nullable().optional(),
  metadata: recordSchema.optional(),
};

export const messageItemSchema = z.object({
  type: z.literal("message"),
  role: itemRoleSchema,
  content: z.array(contentPartSchema),
  parts: messagePartsSchema.optional(),
  ...itemBaseFields,
});

export const toolOutputItemSchema = z.object({
  type: z.literal("tool_output"),
  call_id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.unknown().optional(),
  content: z.array(contentPartSchema),
  parts: messagePartsSchema.optional(),
  data: z.unknown().optional(),
  ...itemBaseFields,
});

export const compactionItemSchema = z.object({
  type: z.literal("compaction"),
  content: z.array(contentPartSchema),
  parts: messagePartsSchema.optional(),
  ...itemBaseFields,
});

export const goalItemSchema = z.object({
  type: z.literal("goal"),
  content: z.array(contentPartSchema),
  parts: messagePartsSchema.optional(),
  ...itemBaseFields,
});

export const toolCallItemSchema = z.object({
  type: z.literal("tool_call"),
  call_id: z.string().min(1),
  name: z.string().optional(),
  arguments: z.union([z.string(), recordSchema]).optional(),
  ...itemBaseFields,
});

export const interactionResponseItemSchema = z
  .object({
    type: z.literal("interaction_response"),
    tool_name: z.string().min(1),
    response: recordSchema,
  })
  .strict();

export const approvalResponseItemSchema = z
  .object({
    type: z.literal("approval_response"),
    approval_id: connectorApprovalIdSchema,
  })
  .strict();

export const storedItemSchema = z.discriminatedUnion("type", [
  messageItemSchema,
  toolOutputItemSchema,
  compactionItemSchema,
  goalItemSchema,
]);

export const itemSchema = z.discriminatedUnion("type", [
  messageItemSchema,
  toolOutputItemSchema,
  compactionItemSchema,
  goalItemSchema,
  toolCallItemSchema,
  interactionResponseItemSchema,
  approvalResponseItemSchema,
]);

export const itemsSchema = z.array(itemSchema);
export const storedItemsSchema = z.array(storedItemSchema);

export type MessageItem = z.infer<typeof messageItemSchema>;
export type ToolCallItem = z.infer<typeof toolCallItemSchema>;
export type ToolOutputItem = z.infer<typeof toolOutputItemSchema>;
export type CompactionItem = z.infer<typeof compactionItemSchema>;
export type GoalItem = z.infer<typeof goalItemSchema>;
export type InteractionResponseItem = z.infer<typeof interactionResponseItemSchema>;
export type ApprovalResponseItem = z.infer<typeof approvalResponseItemSchema>;
export type StoredItem = z.infer<typeof storedItemSchema>;
export type Item = z.infer<typeof itemSchema>;

export interface ItemMessageLike {
  id?: string;
  role: string;
  content?: unknown;
  parts?: unknown;
  status?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_call_arguments?: unknown;
  data?: unknown;
}

export interface StoredItemMessage extends ItemMessageLike {
  role: MessageRole;
  content?: string | ContentPart[];
  parts?: MessagePart[];
  [field: string]: unknown;
}

const MESSAGE_ITEM_ROLES: ReadonlySet<string> = new Set(itemRoleSchema.options);

function contentToParts(content: unknown): ContentPart[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  if (Array.isArray(content)) {
    return content.filter((part): part is ContentPart => isRecord(part));
  }

  if (isRecord(content)) {
    return [{ type: "text", text: JSON.stringify(content) }];
  }

  return [];
}

function isPlainTextPart(part: ContentPart): part is Extract<ContentPart, { type: "text" }> {
  return (
    part.type === "text" &&
    typeof part.text === "string" &&
    Object.keys(part).every((key) => key === "type" || key === "text")
  );
}

function partsToContent(content: ContentPart[]): string | ContentPart[] | undefined {
  if (content.length === 0) {
    return undefined;
  }

  if (content.length === 1 && isPlainTextPart(content[0])) {
    return content[0].text;
  }

  return content;
}

function readParts(parts: unknown): MessagePart[] | undefined {
  const parsed = messagePartsSchema.safeParse(parts);

  return parsed.success && parsed.data.length > 0 ? parsed.data : undefined;
}

function withMetadata<T extends Record<string, unknown>>(
  item: T,
  metadata: Record<string, unknown>,
): T {
  const kept = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );

  return Object.keys(kept).length > 0 ? { ...item, metadata: kept } : item;
}

export function messageToItem(message: ItemMessageLike): StoredItem {
  const {
    id,
    role,
    content,
    parts,
    status,
    name,
    tool_call_id: toolCallId,
    tool_call_arguments: toolCallArguments,
    data,
    ...rest
  }: Record<string, unknown> & ItemMessageLike = { ...message };
  const base = {
    ...(id ? { id } : {}),
    ...(status !== undefined ? { status } : {}),
  };
  const structuredParts = readParts(parts);

  if (role === "tool") {
    return withMetadata(
      {
        type: "tool_output" as const,
        ...base,
        ...(toolCallId !== undefined ? { call_id: toolCallId } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(toolCallArguments !== undefined ? { arguments: toolCallArguments } : {}),
        content: contentToParts(content),
        ...(structuredParts ? { parts: structuredParts } : {}),
        ...(data !== undefined ? { data } : {}),
      },
      rest,
    );
  }

  if (role === "compaction" || role === "goal") {
    return withMetadata(
      {
        type: role,
        ...base,
        content: contentToParts(content),
        ...(structuredParts ? { parts: structuredParts } : {}),
      },
      { ...rest, name, data },
    );
  }

  return withMetadata(
    {
      type: "message" as const,
      role: MESSAGE_ITEM_ROLES.has(role) ? (role as ItemRole) : "user",
      ...base,
      content: contentToParts(content),
      ...(structuredParts ? { parts: structuredParts } : {}),
    },
    {
      ...rest,
      name,
      data,
      ...(toolCallId !== undefined ? { tool_call_id: toolCallId } : {}),
      ...(toolCallArguments !== undefined ? { tool_call_arguments: toolCallArguments } : {}),
    },
  );
}

export function messagesToItems(messages: readonly ItemMessageLike[]): StoredItem[] {
  return messages.map(messageToItem);
}

export function itemToMessage(item: StoredItem): StoredItemMessage {
  const { metadata, id, status, content, parts, type, ...fields } = item;
  const base: StoredItemMessage = {
    ...metadata,
    role: type === "message" ? item.role : type === "tool_output" ? "tool" : type,
    ...(id ? { id } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(parts ? { parts } : {}),
  };
  const messageContent = partsToContent(content);

  if (messageContent !== undefined) {
    base.content = messageContent;
  }

  if (type === "tool_output") {
    const { call_id: callId, name, arguments: toolCallArguments, data } = item;

    return {
      ...base,
      ...(callId !== undefined ? { tool_call_id: callId } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(toolCallArguments !== undefined ? { tool_call_arguments: toolCallArguments } : {}),
      ...(data !== undefined ? { data } : {}),
    };
  }

  void fields;

  return base;
}

export function itemsToMessages(items: readonly StoredItem[]): StoredItemMessage[] {
  return items.map(itemToMessage);
}

export function isStoredItem(item: Item): item is StoredItem {
  return (
    item.type !== "interaction_response" &&
    item.type !== "approval_response" &&
    item.type !== "tool_call"
  );
}

export function itemText(item: StoredItem): string {
  return item.content
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

import { metaNavigationTargetSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const MAX_META_FIND_LIMIT = 20;
export const MAX_META_READ_MESSAGES = 60;

export const findPlacesInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe(
      "Words from a conversation title, project or workspace name. Omit to list recent conversations.",
    ),
  limit: z.number().int().min(1).max(MAX_META_FIND_LIMIT).default(8).optional(),
});

export const openPlaceInputSchema = z.object({
  target: metaNavigationTargetSchema.describe(
    "Where to take the user: a conversation, project, workspace or one of the fixed places.",
  ),
});

export const organiseConversationActionSchema = z.enum([
  "archive",
  "unarchive",
  "pin",
  "unpin",
  "mark_read",
  "mark_unread",
  "snooze_until",
  "snooze_next_response",
  "clear_snooze",
  "rename",
]);

export const organiseConversationInputSchema = z
  .object({
    conversationId: z.string().min(1),
    action: organiseConversationActionSchema,
    title: z.string().trim().min(1).max(200).optional().describe("New title when renaming."),
    until: z
      .string()
      .datetime()
      .optional()
      .describe("ISO timestamp for snooze_until. Must be in the future."),
  })
  .superRefine((input, ctx) => {
    if (input.action === "rename" && !input.title) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Renaming needs a title" });
    }

    if (input.action === "snooze_until" && !input.until) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "snooze_until needs a time" });
    }
  });

export const readConversationInputSchema = z.object({
  conversationId: z.string().min(1),
  maxMessages: z.number().int().min(1).max(MAX_META_READ_MESSAGES).default(30).optional(),
});

export const find_places: FunctionToolDescriptor = {
  name: "find_places",
  description:
    "Find the user's conversations, projects and workspaces by title or name, or list their recent conversations when no query is given. Use it before opening, organising or reading anything you were not given an id for.",
  type: "normal",
  permissions: ["read"],
  inputSchema: findPlacesInputSchema,
};

export const open_place: FunctionToolDescriptor = {
  name: "open_place",
  description:
    "Take the user to a conversation, project, workspace or fixed place in Polychat. Only opens things the user can already access. Prefer this over describing where something is.",
  type: "normal",
  permissions: ["read"],
  inputSchema: openPlaceInputSchema,
};

export const organise_conversation: FunctionToolDescriptor = {
  name: "organise_conversation",
  description:
    "Archive, restore, pin, unpin, mark read or unread, snooze, clear a snooze or rename one conversation the user can access. Confirm before acting on a conversation the user did not name explicitly.",
  type: "normal",
  permissions: ["write"],
  inputSchema: organiseConversationInputSchema,
};

export const read_conversation: FunctionToolDescriptor = {
  name: "read_conversation",
  description:
    "Read a bounded transcript of a conversation the user can access so you can summarise it or answer questions about it. Returns the most recent messages first-to-last.",
  type: "normal",
  permissions: ["read"],
  inputSchema: readConversationInputSchema,
};

export const metaToolDescriptors: FunctionToolDescriptor[] = [
  find_places,
  open_place,
  organise_conversation,
  read_conversation,
];

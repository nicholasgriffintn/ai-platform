import { metaNavigationTargetSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const MAX_META_FIND_LIMIT = 20;
export const MAX_META_READ_MESSAGES = 60;
export const MAX_META_ATTENTION_LIMIT = 25;

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

export const startConversationInputSchema = z
  .object({
    scope: z
      .enum(["personal", "project"])
      .describe("Where the conversation belongs. Project scope needs a projectId."),
    projectId: z.string().min(1).optional().describe("Project that will own the conversation."),
    title: z.string().trim().min(1).max(200).optional().describe("Optional title to give it."),
    openingMessage: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .optional()
      .describe("First message to put in the composer, ready for the user to send."),
    teammateId: z
      .string()
      .min(1)
      .optional()
      .describe("Teammate to answer in this conversation, if the user named one."),
  })
  .superRefine((input, ctx) => {
    if (input.scope === "project" && !input.projectId) {
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Project scope needs a project",
      });
    }
  });

export const hireTeammateInputSchema = z
  .object({
    roleSlug: z.string().min(1).optional().describe("Slug of a built-in role to hire from."),
    jobDescription: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .optional()
      .describe("What the teammate should do, in the user's own words."),
    name: z.string().trim().min(1).max(120).optional().describe("Name for the teammate."),
    workspaceId: z
      .string()
      .min(1)
      .optional()
      .describe("Workspace that will own it. Omit to hire into the user's personal scope."),
  })
  .refine((input) => Boolean(input.roleSlug || input.jobDescription), {
    error: "Choose a role or describe the job",
  });

export const listAttentionInputSchema = z.object({
  kind: z
    .enum(["approval", "input", "review", "failed", "running", "completed"])
    .optional()
    .describe("Narrow to one kind of waiting work."),
  projectId: z.string().min(1).optional().describe("Narrow to one project."),
  limit: z.number().int().min(1).max(MAX_META_ATTENTION_LIMIT).default(10).optional(),
});

export const start_conversation: FunctionToolDescriptor = {
  name: "start_conversation",
  description:
    "Start a new conversation for the user, personally or in a project they belong to, and take them to it. Put the first message in the composer rather than sending it, so the user stays in control of what gets asked.",
  type: "normal",
  permissions: ["write"],
  inputSchema: startConversationInputSchema,
};

export const hire_teammate: FunctionToolDescriptor = {
  name: "hire_teammate",
  description:
    "Hire a teammate from a built-in role, from a description of the job, or both. Confirm the role and the name with the user before calling this; it creates a real teammate they will see in their library.",
  type: "normal",
  permissions: ["write"],
  inputSchema: hireTeammateInputSchema,
};

export const list_attention: FunctionToolDescriptor = {
  name: "list_attention",
  description:
    "List the project work waiting on the user across every workspace they belong to: approvals, questions, reviews and failures. Use it to answer what needs them now.",
  type: "normal",
  permissions: ["read"],
  inputSchema: listAttentionInputSchema,
};

export const metaToolDescriptors: FunctionToolDescriptor[] = [
  find_places,
  open_place,
  organise_conversation,
  read_conversation,
  start_conversation,
  hire_teammate,
  list_attention,
];

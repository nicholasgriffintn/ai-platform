import z from "zod/v4";

import { conversationGroupSchema, conversationSnoozeSchema } from "./conversation-organisation";

export const searchWebSchema = z.object({
  query: z.string(),
  provider: z.enum(["serper", "tavily"]),
  options: z
    .object({
      search_depth: z.enum(["basic", "advanced"]).optional(),
      include_answer: z.boolean().optional(),
      include_raw_content: z.boolean().optional(),
      include_images: z.boolean().optional(),
      country: z.string().optional(),
      location: z.string().optional(),
      language: z.string().optional(),
      timePeriod: z.string().optional(),
      autocorrect: z.boolean().optional(),
      num: z.number().optional(),
      page: z.number().optional(),
    })
    .optional(),
});

export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  position: z.number().optional(),
});

export const webSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(searchResultSchema),
    query: z.string(),
  }),
});

export const globalSearchQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const globalSearchConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  updatedAt: z.string().nullable(),
  isPinned: z.boolean(),
  isUnread: z.boolean(),
  snooze: conversationSnoozeSchema.nullable(),
  group: conversationGroupSchema.nullable(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
      workspaceId: z.string(),
      workspaceName: z.string(),
    })
    .nullable(),
});

export const globalSearchWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  updatedAt: z.string().nullable(),
});

export const globalSearchProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  name: z.string(),
  description: z.string(),
  updatedAt: z.string().nullable(),
});

export const globalSearchResponseSchema = z.object({
  query: z.string(),
  conversations: z.array(globalSearchConversationSchema),
  workspaces: z.array(globalSearchWorkspaceSchema),
  projects: z.array(globalSearchProjectSchema),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type GlobalSearchConversation = z.infer<typeof globalSearchConversationSchema>;
export type GlobalSearchWorkspace = z.infer<typeof globalSearchWorkspaceSchema>;
export type GlobalSearchProject = z.infer<typeof globalSearchProjectSchema>;
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;

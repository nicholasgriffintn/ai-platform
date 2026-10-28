import z from "zod/v4";

import { conversationGroupSchema, conversationSnoozeSchema } from "./conversation-organisation.js";

export const searchProviderSchema = z.enum([
  "serper",
  "tavily",
  "parallel",
  "duckduckgo",
  "perplexity",
  "exa",
  "greenpt",
  "cloudflare",
  "cloudflare-ai-search",
]);

export const NEWS_SEARCH_PROVIDERS: readonly z.infer<typeof searchProviderSchema>[] = [
  "tavily",
  "serper",
];

export const cloudflareWebSearchProviderSchema = z.enum(["ceramic", "exa", "linkup"]);

export const searchOptionsSchema = z.object({
  topic: z.enum(["general", "news"]).optional(),
  days: z.number().int().min(1).max(30).optional(),
  search_depth: z.enum(["basic", "advanced"]).optional(),
  include_answer: z.boolean().optional(),
  include_raw_content: z.boolean().optional(),
  include_images: z.boolean().optional(),
  max_results: z.number().int().min(1).max(50).optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional(),
  timePeriod: z.string().optional(),
  autocorrect: z.boolean().optional(),
  num: z.number().int().min(1).max(50).optional(),
  page: z.number().int().min(1).optional(),
  system_prompt: z.string().optional(),
  parallel_search_queries: z.array(z.string()).optional(),
  parallel_processor: z.string().optional(),
  parallel_max_chars_per_result: z.number().int().positive().optional(),
  cloudflare_provider: cloudflareWebSearchProviderSchema.optional(),
  retrieval_type: z.enum(["vector", "keyword", "hybrid"]).optional(),
});

export type SearchProviderName = z.infer<typeof searchProviderSchema>;
export type SearchOptions = z.infer<typeof searchOptionsSchema>;

export const searchWebSchema = z.object({
  query: z.string().trim().min(1).max(4096),
  provider: searchProviderSchema.optional(),
  options: searchOptionsSchema.optional(),
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

export const globalSearchTaskSchema = z.object({
  id: z.string(),
  key: z.string().nullable(),
  objective: z.string(),
  status: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  workspaceId: z.string(),
  updatedAt: z.string().nullable(),
});

export const globalSearchDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  snippet: z.string(),
  updatedAt: z.string().nullable(),
});

export const globalSearchResponseSchema = z.object({
  query: z.string(),
  conversations: z.array(globalSearchConversationSchema),
  documents: z.array(globalSearchDocumentSchema),
  workspaces: z.array(globalSearchWorkspaceSchema),
  projects: z.array(globalSearchProjectSchema),
  tasks: z.array(globalSearchTaskSchema).default([]),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type GlobalSearchConversation = z.infer<typeof globalSearchConversationSchema>;
export type GlobalSearchWorkspace = z.infer<typeof globalSearchWorkspaceSchema>;
export type GlobalSearchProject = z.infer<typeof globalSearchProjectSchema>;
export type GlobalSearchDocument = z.infer<typeof globalSearchDocumentSchema>;
export type GlobalSearchTask = z.infer<typeof globalSearchTaskSchema>;
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;

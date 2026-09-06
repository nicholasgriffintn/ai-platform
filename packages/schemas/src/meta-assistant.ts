import { z } from "zod";

export const META_ASSISTANT_CONVERSATION_TYPE = "meta";

export const META_NAVIGATION_DATA_KEY = "metaNavigation";

export const metaAssistantPlaceSchema = z.enum([
  "chat",
  "work",
  "attention",
  "files",
  "library",
  "you",
]);

export const metaAssistantUiContextSchema = z.object({
  route: z.string().max(512).optional(),
  place: metaAssistantPlaceSchema.optional(),
  conversationId: z.string().max(128).optional(),
  workspaceId: z.string().max(128).optional(),
  projectId: z.string().max(128).optional(),
  taskId: z.string().max(128).optional(),
  runId: z.string().max(128).optional(),
});

export const metaAssistantRequestSchema = z.object({
  ui_context: metaAssistantUiContextSchema.optional(),
});

export const META_TOOL_NAMES = [
  "find_places",
  "open_place",
  "organise_conversation",
  "summarise_conversation",
] as const;

const metaToolNameSet: ReadonlySet<string> = new Set(META_TOOL_NAMES);

export function isMetaToolName(name: string): name is MetaToolName {
  return metaToolNameSet.has(name);
}

export const metaNavigationTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("conversation"),
    conversationId: z.string(),
    workspaceId: z.string().optional(),
    projectId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("project"),
    workspaceId: z.string(),
    projectId: z.string(),
  }),
  z.object({
    kind: z.literal("workspace"),
    workspaceId: z.string(),
  }),
  z.object({
    kind: z.literal("place"),
    place: metaAssistantPlaceSchema,
  }),
]);

export const metaFoundConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  updatedAt: z.string().nullable(),
  isArchived: z.boolean(),
  isPinned: z.boolean(),
  isUnread: z.boolean(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
      workspaceId: z.string(),
      workspaceName: z.string(),
    })
    .nullable(),
});

export type MetaAssistantPlace = z.infer<typeof metaAssistantPlaceSchema>;
export type MetaAssistantUiContext = z.infer<typeof metaAssistantUiContextSchema>;
export type MetaAssistantRequest = z.infer<typeof metaAssistantRequestSchema>;
export type MetaToolName = (typeof META_TOOL_NAMES)[number];
export type MetaNavigationTarget = z.infer<typeof metaNavigationTargetSchema>;
export type MetaFoundConversation = z.infer<typeof metaFoundConversationSchema>;

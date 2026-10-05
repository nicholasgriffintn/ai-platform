import { z } from "zod";

import { teammateAutonomyLevelSchema } from "./teammate-contexts.js";

export const POLY_CONVERSATION_TYPE = "poly";

export const POLY_NAVIGATION_DATA_KEY = "polyNavigation";

export const polyModeSchema = z.enum(["chat", "work"]);

export const polyPlaceSchema = z.enum([
  "conversations",
  "canvas",
  "sites",
  "attention",
  "files",
  "teammates",
  "plugins",
  "scheduled",
  "you",
]);

export const polyUiContextSchema = z.object({
  route: z.string().max(512).optional(),
  mode: polyModeSchema.optional(),
  place: polyPlaceSchema.optional(),
  conversationId: z.string().max(128).optional(),
  workspaceId: z.string().max(128).optional(),
  projectId: z.string().max(128).optional(),
  taskId: z.string().max(128).optional(),
  runId: z.string().max(128).optional(),
});

export const polyRequestSchema = z.object({
  ui_context: polyUiContextSchema.optional(),
});

export const POLY_NAVIGATION_TOOL_NAMES = [
  "find_places",
  "open_place",
  "organise_conversation",
  "read_conversation",
  "start_conversation",
  "hire_teammate",
  "list_attention",
] as const;

const polyNavigationToolNameSet: ReadonlySet<string> = new Set(POLY_NAVIGATION_TOOL_NAMES);

export function isPolyNavigationToolName(name: string): name is PolyNavigationToolName {
  return polyNavigationToolNameSet.has(name);
}

export const polyNavigationTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("conversation"),
    conversationId: z.string(),
    workspaceId: z.string().optional(),
    projectId: z.string().optional(),
    openingMessage: z.string().optional(),
    teammateId: z.string().optional(),
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
    place: polyPlaceSchema,
    mode: polyModeSchema.default("chat"),
    workspaceId: z.string().optional(),
    projectId: z.string().optional(),
  }),
]);

export const polyFoundConversationSchema = z.object({
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

export type PolyPlace = z.infer<typeof polyPlaceSchema>;
export type PolyUiContext = z.infer<typeof polyUiContextSchema>;
export type PolyRequest = z.infer<typeof polyRequestSchema>;
export type PolyNavigationToolName = (typeof POLY_NAVIGATION_TOOL_NAMES)[number];
export type PolyMode = z.infer<typeof polyModeSchema>;
export type PolyNavigationTarget = z.infer<typeof polyNavigationTargetSchema>;
export type PolyFoundConversation = z.infer<typeof polyFoundConversationSchema>;

export const polyHomeSchema = z.object({
  teammate_id: z.string().min(1),
  context_id: z.string().min(1),
  conversation_id: z.string().min(1),
  autonomy_level: teammateAutonomyLevelSchema,
});

export type PolyHome = z.infer<typeof polyHomeSchema>;

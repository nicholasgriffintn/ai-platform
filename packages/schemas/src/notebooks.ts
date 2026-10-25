import z from "zod/v4";

import { conversationGroupScopeSchema } from "./conversation-organisation.js";
import { outputSummarySchema } from "./outputs.js";
import { listSchema } from "./platform/list.js";
import { podcastFormatSchema, podcastLengthSchema } from "./source-media.js";
import { sourceSummarySchema } from "./sources.js";
import { videoOverviewStyleSchema } from "./study-outputs.js";

export const NOTEBOOK_JOB_TASK_TYPE = "notebook_job";
export const NOTEBOOK_FILE_TOOL_NAME = "file_in_notebook";

export const fileInNotebookInputSchema = z
  .object({
    notebook: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("The notebook's name as the person says it, or its id."),
    sourceIds: z
      .array(z.string().min(1))
      .max(50)
      .optional()
      .describe("Ids of sources in Files to link into the notebook."),
    url: z.url().max(2_048).optional().describe("A web page to read into the notebook."),
    title: z.string().trim().min(1).max(200).optional().describe("A title for the page."),
    note: z
      .object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(100_000),
      })
      .strict()
      .optional()
      .describe("A note to add, written for the person in their words."),
    create: z
      .boolean()
      .default(false)
      .describe("Make the notebook when none has that name. Only when the person asked for it."),
  })
  .strict();

export type FileInNotebookInput = z.infer<typeof fileInNotebookInputSchema>;
export const NOTEBOOK_MAX_SOURCES = 300;
export const NOTEBOOK_INSTRUCTIONS_MAX = 10_000;
export const NOTEBOOK_SOURCE_CITATION_PREFIX = "#source-";

export const notebookChatStyleSchema = z.enum(["default", "learning_guide", "custom"]);
export const notebookResponseLengthSchema = z.enum(["default", "longer", "shorter"]);

export const notebookSettingsSchema = z
  .object({
    style: notebookChatStyleSchema.default("default"),
    persona: z.string().trim().max(2_000).default(""),
    responseLength: notebookResponseLengthSchema.default("default"),
    sourcesOnly: z.boolean().default(true),
    followTopic: z.string().trim().min(1).max(60).nullable().default(null),
    discover: z.boolean().default(false),
  })
  .strict();

export const notebookGuideDraftSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .describe(
        "One paragraph on what the sources cover together. Bold the four to six most important terms with **double asterisks**.",
      ),
    questions: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(3)
      .describe(
        "Three questions a reader would want answered next, each answerable from the sources.",
      ),
  })
  .strict();

export const notebookGuideSchema = notebookGuideDraftSchema
  .extend({
    sourceIds: z.array(z.string().min(1)).max(NOTEBOOK_MAX_SOURCES),
    generatedAt: z.string(),
  })
  .strict();

export const notebookGuideStatusSchema = z.enum(["current", "writing", "unavailable"]);

export const notebookSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(40),
    scope: conversationGroupScopeSchema,
    instructions: z.string().max(NOTEBOOK_INSTRUCTIONS_MAX),
    settings: notebookSettingsSchema,
    guide: notebookGuideSchema.nullable(),
    canManage: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const notebookConversationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const notebookDetailSchema = notebookSchema
  .extend({
    guideStatus: notebookGuideStatusSchema,
    sources: z.array(sourceSummarySchema),
    notes: z.array(sourceSummarySchema),
    media: z.array(sourceSummarySchema),
    outputs: z.array(outputSummarySchema),
    conversations: z.array(notebookConversationSchema),
  })
  .strict();

export const conversationNotebookSchema = z
  .object({
    id: z.string().min(1),
    source_ids: z.array(z.string().min(1)).max(NOTEBOOK_MAX_SOURCES).optional(),
  })
  .strict();

export const notebookListQuerySchema = z
  .object({ project_id: z.string().min(1).optional() })
  .strict();

export const notebookListResponseSchema = listSchema(notebookSchema);

export const notebookParamsSchema = z.object({ notebook_id: z.string().min(1) }).strict();

export const notebookSourceParamsSchema = notebookParamsSchema
  .extend({ source_id: z.string().min(1) })
  .strict();

export const updateNotebookSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    instructions: z.string().max(NOTEBOOK_INSTRUCTIONS_MAX).optional(),
    settings: notebookSettingsSchema.partial().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Change at least one notebook field",
  });

export const createNotebookNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(100_000),
  })
  .strict();

export const notebookResearchDepthSchema = z.enum(["fast", "deep"]);

export const notebookResearchSchema = z
  .object({
    query: z.string().trim().min(1).max(1_000),
    depth: notebookResearchDepthSchema.default("fast"),
  })
  .strict();

export const notebookResearchResultSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    url: z.url().max(2_048),
    snippet: z.string().max(1_000),
  })
  .strict();

export const notebookResearchResponseSchema = z.discriminatedUnion("depth", [
  z.object({ depth: z.literal("fast"), results: z.array(notebookResearchResultSchema) }).strict(),
  z.object({ depth: z.literal("deep"), report: sourceSummarySchema }).strict(),
]);

export const importNotebookResearchSchema = z
  .object({
    results: z
      .array(notebookResearchResultSchema.pick({ title: true, url: true }))
      .min(1)
      .max(20),
  })
  .strict();

export const linkNotebookSourcesSchema = z.union([
  z.object({ sourceIds: z.array(z.string().min(1)).min(1).max(100) }).strict(),
  importNotebookResearchSchema,
]);

export const createNotebookSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    scope: conversationGroupScopeSchema,
  })
  .strict();

export const notebookDeckStyleSchema = z.enum(["detailed", "presenter"]);
export const notebookDeckLengthSchema = z.enum(["short", "default", "long"]);
export const notebookReportTemplateSchema = z.enum([
  "briefing",
  "study_guide",
  "faq",
  "blog_post",
  "custom",
]);
export const notebookInfographicOrientationSchema = z.enum(["landscape", "portrait", "square"]);
export const notebookStudyCountSchema = z.enum(["fewer", "standard", "more"]);
export const notebookStudyDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const notebookVideoFormatSchema = z.enum(["explainer", "brief"]);

const studioBase = {
  sourceIds: z.array(z.string().min(1)).max(NOTEBOOK_MAX_SOURCES).optional(),
  focus: z.string().trim().max(2_000).optional(),
  language: z.string().trim().min(2).max(10).default("en"),
};

export const notebookStudioRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("audio"),
      format: podcastFormatSchema.default("deep_dive"),
      length: podcastLengthSchema.default("default"),
      ...studioBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("deck"),
      style: notebookDeckStyleSchema.default("detailed"),
      length: notebookDeckLengthSchema.default("default"),
      ...studioBase,
    })
    .strict(),
  z.object({ kind: z.literal("sheet"), ...studioBase }).strict(),
  z
    .object({
      kind: z.literal("report"),
      template: notebookReportTemplateSchema.default("briefing"),
      ...studioBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("infographic"),
      orientation: notebookInfographicOrientationSchema.default("landscape"),
      ...studioBase,
    })
    .strict(),
  z.object({ kind: z.literal("mind_map"), ...studioBase }).strict(),
  z
    .object({
      kind: z.literal("flashcards"),
      count: notebookStudyCountSchema.default("standard"),
      difficulty: notebookStudyDifficultySchema.default("medium"),
      ...studioBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("quiz"),
      count: notebookStudyCountSchema.default("standard"),
      difficulty: notebookStudyDifficultySchema.default("medium"),
      ...studioBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("video"),
      format: notebookVideoFormatSchema.default("explainer"),
      style: videoOverviewStyleSchema.default("classic"),
      ...studioBase,
    })
    .strict(),
]);

export const notebookStudioResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("output"), output: outputSummarySchema }).strict(),
  z.object({ type: z.literal("source"), source: sourceSummarySchema }).strict(),
]);

export const notebookJobTaskDataSchema = z.discriminatedUnion("job", [
  z.object({ job: z.literal("guide"), notebookId: z.string().min(1) }).strict(),
  z
    .object({
      job: z.literal("studio"),
      notebookId: z.string().min(1),
      outputId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      job: z.literal("infographic"),
      notebookId: z.string().min(1),
      sourceId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      job: z.literal("research"),
      notebookId: z.string().min(1),
      sourceId: z.string().min(1),
      query: z.string().min(1),
    })
    .strict(),
]);

export type NotebookChatStyle = z.infer<typeof notebookChatStyleSchema>;
export type NotebookResponseLength = z.infer<typeof notebookResponseLengthSchema>;
export type NotebookSettings = z.infer<typeof notebookSettingsSchema>;
export type NotebookGuideDraft = z.infer<typeof notebookGuideDraftSchema>;
export type NotebookGuide = z.infer<typeof notebookGuideSchema>;
export type NotebookGuideStatus = z.infer<typeof notebookGuideStatusSchema>;
export type Notebook = z.infer<typeof notebookSchema>;
export type NotebookConversation = z.infer<typeof notebookConversationSchema>;
export type ConversationNotebook = z.infer<typeof conversationNotebookSchema>;
export type NotebookDetail = z.infer<typeof notebookDetailSchema>;
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;
export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type LinkNotebookSourcesInput = z.infer<typeof linkNotebookSourcesSchema>;
export type CreateNotebookNoteInput = z.infer<typeof createNotebookNoteSchema>;
export type NotebookResearchDepth = z.infer<typeof notebookResearchDepthSchema>;
export type NotebookResearchInput = z.input<typeof notebookResearchSchema>;
export type NotebookResearchResult = z.infer<typeof notebookResearchResultSchema>;
export type NotebookResearchResponse = z.infer<typeof notebookResearchResponseSchema>;
export type ImportNotebookResearchInput = z.infer<typeof importNotebookResearchSchema>;
export type NotebookDeckStyle = z.infer<typeof notebookDeckStyleSchema>;
export type NotebookDeckLength = z.infer<typeof notebookDeckLengthSchema>;
export type NotebookReportTemplate = z.infer<typeof notebookReportTemplateSchema>;
export type NotebookInfographicOrientation = z.infer<typeof notebookInfographicOrientationSchema>;
export type NotebookStudyCount = z.infer<typeof notebookStudyCountSchema>;
export type NotebookStudyDifficulty = z.infer<typeof notebookStudyDifficultySchema>;
export type NotebookVideoFormat = z.infer<typeof notebookVideoFormatSchema>;
export type NotebookStudioRequest = z.infer<typeof notebookStudioRequestSchema>;
export type NotebookStudioKind = NotebookStudioRequest["kind"];
export type NotebookStudioRequestInput = z.input<typeof notebookStudioRequestSchema>;
export type NotebookStudioResponse = z.infer<typeof notebookStudioResponseSchema>;
export type NotebookJobTaskData = z.infer<typeof notebookJobTaskDataSchema>;

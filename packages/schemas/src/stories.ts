import z from "zod/v4";

import { discoverCoverageDraftSchema } from "./discover.js";
import { externalHttpUrlSchema } from "./navigation.js";

export const STORIES_JOB_TASK_TYPE = "stories_job";
export const STORY_QUOTE_MAX_WORDS = 40;
export const STORY_INTAKE_LIMIT = 80;

function text() {
  return z.string().trim().min(1);
}

export const storyStatusSchema = z.enum(["open", "closed"]);
export type StoryStatus = z.infer<typeof storyStatusSchema>;

export const storyIntakeArticleSchema = z
  .object({
    url: externalHttpUrlSchema,
    headline: z.string().trim().min(1).max(300),
    standfirst: z.string().trim().max(600),
    outlet: z.string().trim().min(1).max(120),
    topic: z.string().trim().min(1).max(80),
    publishedAt: z.iso.datetime(),
    imageUrl: externalHttpUrlSchema.optional(),
  })
  .strict();
export type StoryIntakeArticle = z.infer<typeof storyIntakeArticleSchema>;

export const storiesJobTaskDataSchema = z.discriminatedUnion("job", [
  z
    .object({
      job: z.literal("ingest"),
      articles: z.array(storyIntakeArticleSchema).min(1).max(STORY_INTAKE_LIMIT),
    })
    .strict(),
  z.object({ job: z.literal("refresh"), storyId: z.string().min(1) }).strict(),
  z.object({ job: z.literal("backfill"), after: z.string().min(1).optional() }).strict(),
]);
export type StoriesJobTaskData = z.infer<typeof storiesJobTaskDataSchema>;

export const storyVersionDraftSchema = discoverCoverageDraftSchema.extend({
  title: text()
    .max(160)
    .describe("A plain, neutral headline for the whole story, not any one outlet's wording."),
  overview: z
    .array(text())
    .min(3)
    .max(6)
    .describe("Three to six short bullets on what happened and why it matters, newest first."),
});
export type StoryVersionDraft = z.infer<typeof storyVersionDraftSchema>;

export const storySummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string(),
  title: z.string(),
  status: storyStatusSchema,
  openedAt: z.string(),
  lastArticleAt: z.string(),
  articleCount: z.number().int().nonnegative(),
  outletCount: z.number().int().nonnegative(),
  topicKey: z.string().nullable(),
});
export type StorySummary = z.infer<typeof storySummarySchema>;

export const storyVersionSchema = z.object({
  version: z.number().int().positive(),
  writtenAt: z.string(),
  overview: z.array(z.string()),
  agreed: z.array(z.string()),
  disputed: z.array(z.string()),
  gaps: z.array(z.string()),
  outlets: z.array(z.object({ source: z.string(), angle: z.string() })),
});
export type StoryVersion = z.infer<typeof storyVersionSchema>;

export const storyArticleSchema = z.object({
  id: z.string().min(1),
  url: externalHttpUrlSchema,
  outlet: z.string(),
  headline: z.string(),
  standfirst: z.string(),
  publishedAt: z.string(),
  imageUrl: externalHttpUrlSchema.nullable(),
});
export type StoryArticle = z.infer<typeof storyArticleSchema>;

export const storyPageSchema = z.object({
  story: storySummarySchema,
  version: storyVersionSchema.nullable(),
  articles: z.array(storyArticleSchema),
});
export type StoryPage = z.infer<typeof storyPageSchema>;

export const storyParamsSchema = z.object({ story_id: z.string().min(1).max(80) });

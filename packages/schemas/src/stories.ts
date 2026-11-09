import z from "zod/v4";

import { discoverCoverageDraftSchema } from "./discover.js";
import { externalHttpUrlSchema } from "./navigation.js";

export const STORIES_JOB_TASK_TYPE = "stories_job";
export const STORY_QUOTE_MAX_WORDS = 40;
export const STORY_INTAKE_LIMIT = 80;
export const STORY_RECLUSTER_LIMIT = 5000;
export const STORY_PATH_PREFIX = "/discover/stories";

export function getStoryPath(storyId: string): string {
  return `${STORY_PATH_PREFIX}/${encodeURIComponent(storyId)}`;
}

function text() {
  return z.string().trim().min(1);
}

export const STORY_ENTITY_KINDS = ["person", "organisation", "place", "product"] as const;
export const storyEntityKindSchema = z.enum(STORY_ENTITY_KINDS);
export type StoryEntityKind = z.infer<typeof storyEntityKindSchema>;
export const STORY_ENTITY_ROLES = ["subject", "quoted", "mentioned"] as const;
export const storyEntityRoleSchema = z.enum(STORY_ENTITY_ROLES);
export type StoryEntityRole = z.infer<typeof storyEntityRoleSchema>;
export const storyEdgeKindSchema = z.enum(["continues", "background", "contrast"]);
export type StoryEdgeKind = z.infer<typeof storyEdgeKindSchema>;

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
  z
    .object({
      job: z.literal("recluster"),
      articles: z.array(storyIntakeArticleSchema).max(STORY_RECLUSTER_LIMIT),
    })
    .strict(),
]);
export type StoriesJobTaskData = z.infer<typeof storiesJobTaskDataSchema>;

export const storyVersionDraftSchema = discoverCoverageDraftSchema.extend({
  title: text()
    .max(160)
    .describe("A plain, neutral headline for the whole story, not any one outlet's wording."),
  overview: z
    .array(text())
    .min(2)
    .max(6)
    .describe("Two to six short bullets on what happened and why it matters, newest first."),
  quotes: z
    .array(
      z
        .object({
          speaker: text().max(120).describe("Who said it, named as the article names them."),
          context: z
            .string()
            .trim()
            .max(160)
            .describe("Their role or the occasion, such as 'Health Secretary, at a briefing'."),
          outlet: text().describe(
            "The outlet whose article carries the quote, named exactly as given.",
          ),
          text: text()
            .max(400)
            .describe(
              `The quoted words copied character for character from the article, under ${STORY_QUOTE_MAX_WORDS} words.`,
            ),
        })
        .strict(),
    )
    .max(8)
    .describe(
      "Direct quotations that appear word for word in the articles. Leave it empty when there are none.",
    ),
  entities: z
    .array(
      z
        .object({
          name: text().max(120).describe("The person, organisation, place or product, as named."),
          kind: storyEntityKindSchema,
          role: storyEntityRoleSchema.describe(
            "subject when the story is about them, quoted when they speak, otherwise mentioned.",
          ),
        })
        .strict(),
    )
    .max(16)
    .describe(
      "The people, organisations, places and products the story involves, most central first.",
    ),
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

export const storyQuoteSchema = z.object({
  id: z.string().min(1),
  storyId: z.string().min(1),
  speaker: z.string(),
  speakerEntityId: z.string().nullable(),
  context: z.string(),
  text: z.string(),
  outlet: z.string(),
  url: externalHttpUrlSchema,
  verifiedAt: z.string(),
});
export type StoryQuote = z.infer<typeof storyQuoteSchema>;

export const storyEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: storyEntityKindSchema,
  aliases: z.array(z.string()),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  mentionCount: z.number().int().nonnegative(),
});
export type StoryEntity = z.infer<typeof storyEntitySchema>;

export const storyEntityMentionSchema = storyEntitySchema
  .pick({ id: true, name: true, kind: true })
  .extend({ role: storyEntityRoleSchema });
export type StoryEntityMention = z.infer<typeof storyEntityMentionSchema>;

export const relatedStorySchema = storySummarySchema.extend({
  kind: storyEdgeKindSchema.nullable(),
  score: z.number(),
});
export type RelatedStory = z.infer<typeof relatedStorySchema>;

export const storyVersionHistorySchema = storyVersionSchema.pick({
  version: true,
  writtenAt: true,
  overview: true,
});
export type StoryVersionHistory = z.infer<typeof storyVersionHistorySchema>;

export const storyOutletCoverageSchema = z.object({
  outlet: z.string(),
  articleCount: z.number().int().nonnegative(),
  leadCount: z.number().int().nonnegative(),
  firstPublishedAt: z.string(),
});
export type StoryOutletCoverage = z.infer<typeof storyOutletCoverageSchema>;

export const storyPageSchema = z.object({
  story: storySummarySchema,
  version: storyVersionSchema.nullable(),
  history: z.array(storyVersionHistorySchema),
  coverage: z.array(storyOutletCoverageSchema),
  articles: z.array(storyArticleSchema),
  quotes: z.array(storyQuoteSchema),
  entities: z.array(storyEntityMentionSchema),
  before: z.array(relatedStorySchema),
});
export type StoryPage = z.infer<typeof storyPageSchema>;

export const storyReclusterResponseSchema = z.object({ status: z.literal("queued") });

export const storyParamsSchema = z.object({ story_id: z.string().min(1).max(80) });

export const entityPageSchema = z.object({
  entity: storyEntitySchema,
  stories: z.array(storySummarySchema.extend({ role: storyEntityRoleSchema })),
  quotes: z.array(storyQuoteSchema),
  outlets: z.array(storyOutletCoverageSchema),
});
export type EntityPage = z.infer<typeof entityPageSchema>;

export const entityParamsSchema = z.object({ entity_id: z.string().min(1).max(80) });

export const readStoryInputSchema = z
  .object({
    storyId: z.string().min(1).max(80).describe("The story id, as given on a Discover card."),
  })
  .strict();

export const findRelatedStoriesInputSchema = z
  .object({
    storyId: z.string().min(1).max(80).optional().describe("Find stories connected to this story."),
    query: z
      .string()
      .trim()
      .min(2)
      .max(300)
      .optional()
      .describe("Or describe the event or subject to look for."),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict()
  .refine((input) => Boolean(input.storyId || input.query), {
    message: "Give a storyId or a query",
  });

export const STORY_WORLD_SOURCE_KINDS = ["chat", "notebook", "memory"] as const;
export const storyWorldItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(STORY_WORLD_SOURCE_KINDS),
  title: z.string(),
  snippet: z.string(),
  matched: z.string(),
  notebookId: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type StoryWorldItem = z.infer<typeof storyWorldItemSchema>;

export const storyWorldSchema = z.object({
  searched: z.array(z.string()),
  items: z.array(storyWorldItemSchema),
});
export type StoryWorld = z.infer<typeof storyWorldSchema>;

export const coverageTrackerQuerySchema = z.object({
  weeks: z.coerce.number().int().min(2).max(26).default(8),
});

export const coverageTopicSchema = z.object({ key: z.string(), label: z.string() });

const coverageTopicCountSchema = z.object({
  topicKey: z.string(),
  articleCount: z.number().int().nonnegative(),
});

export const coverageTrackerSchema = z.object({
  until: z.string().nullable(),
  weeks: z.array(z.string()),
  topics: z.array(coverageTopicSchema),
  topicShare: z.array(
    z.object({
      week: z.string(),
      topicKey: z.string(),
      articleCount: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
    }),
  ),
  heatmap: z.object({
    outlets: z.array(
      z.object({ id: z.string(), name: z.string(), articleCount: z.number().int().nonnegative() }),
    ),
    cells: z.array(
      z.object({
        outletId: z.string(),
        topicKey: z.string(),
        articleCount: z.number().int().nonnegative(),
        share: z.number().min(0).max(1),
      }),
    ),
  }),
  droppedOff: z.array(
    z.object({
      story: storySummarySchema,
      previous: z.number().int().nonnegative(),
      current: z.number().int().nonnegative(),
    }),
  ),
  terms: z.array(
    z.object({
      key: z.string(),
      term: z.string(),
      total: z.number().int().nonnegative(),
      weeks: z.array(z.object({ week: z.string(), articleCount: z.number().int().nonnegative() })),
    }),
  ),
  thisWeek: z.object({
    since: z.string(),
    outlets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        current: z.array(coverageTopicCountSchema),
        previous: z.array(coverageTopicCountSchema),
      }),
    ),
    names: z.array(
      z.object({
        key: z.string(),
        term: z.string(),
        current: z.number().int().nonnegative(),
        previous: z.number().int().nonnegative(),
        trend: z.enum(["rising", "fading"]),
        days: z.array(z.number().int().nonnegative()),
      }),
    ),
    lead: z
      .object({ story: storySummarySchema, articleCount: z.number().int().nonnegative() })
      .nullable(),
  }),
});
export type CoverageTracker = z.infer<typeof coverageTrackerSchema>;

export const compareCoverageInputSchema = z
  .object({
    storyId: z.string().min(1).max(80).describe("The story id, as given on a Discover card."),
  })
  .strict();

export const followEntityInputSchema = z
  .object({
    entityId: z
      .string()
      .min(1)
      .max(80)
      .describe("The entity id, from read_story or an entity page."),
  })
  .strict();

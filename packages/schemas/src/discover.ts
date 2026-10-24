import z from "zod/v4";

import { discoverEpisodeLengthSchema } from "./discover-episodes.js";
import { externalHttpUrlSchema, internalNavigationPathSchema } from "./navigation.js";
import { videoOverviewStyleSchema } from "./study-outputs.js";

export const DISCOVER_CAPABILITY_ID = "discover";
export const DISCOVER_EDITION_KIND = "discover.edition";
export const DISCOVER_FEEDBACK_KIND = "discover.feedback";
export const DISCOVER_RECIPE_ID = "poly-discover";
export const DISCOVER_CRON = "0 7 * * *";
export const DISCOVER_EVENING_CRON = "0 19 * * *";
export const DISCOVER_EDITION_TIMES = ["morning", "evening"] as const;
export const discoverEditionTimeSchema = z.enum(DISCOVER_EDITION_TIMES);
export type DiscoverEditionTime = z.infer<typeof discoverEditionTimeSchema>;
export const DISCOVER_EDITION_RETENTION_DAYS = 14;
export const DISCOVER_LINK_RETENTION_DAYS = 30;
export const DISCOVER_LINK_METADATA_KEY = "discoverLink";
export const DISCOVER_CONTEXT_TOOL_NAME = "read_discover_context";
export const DISCOVER_COMPOSE_TOOL_NAME = "compose_discover_edition";
export const DISCOVER_MAX_CARDS = 12;
export const DISCOVER_MAX_BRIEF_LINES = 5;
export const DISCOVER_MAX_INTERESTS = 8;
export const DISCOVER_CURATE_MAX_LENGTH = 500;
export const DISCOVER_EDITION_VERSION = 1;
export const DISCOVER_JOB_TASK_TYPE = "discover_job";
export const DISCOVER_NOTEBOOK_NAME = "Discover";
export const DISCOVER_SIGNAL_METADATA_KEY = "discoverSignal";
export const DISCOVER_RESEARCH_METADATA_KEY = "discoverResearch";
export const DISCOVER_GATHER_HOUR = 5;
export const DISCOVER_FRESH_HOURS = 20;
export const DISCOVER_RESEARCH_DAYS_KEPT = 7;

function text(max: number) {
  return z.string().trim().min(1).max(max);
}

const reasonSchema = text(200).describe(
  "Why this person would care, naming the signal: a chat, a followed topic, feedback or their request.",
);
const topicSchema = text(60).describe("The interest this belongs to, in two or three words.");
const sensitiveSchema = z
  .boolean()
  .default(false)
  .describe("True when it touches health, sexuality, religion, politics or money.");

export const discoverHrefSchema = z.union([externalHttpUrlSchema, internalNavigationPathSchema]);

export const discoverInterestSchema = z
  .object({
    topic: topicSchema,
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

export const DISCOVER_BRIEF_KINDS = [
  "waiting",
  "calendar",
  "topic",
  "weather",
  "on_this_day",
  "note",
] as const;

export const discoverBriefKindSchema = z.enum(DISCOVER_BRIEF_KINDS);

export const discoverBriefLineSchema = z
  .object({
    kind: discoverBriefKindSchema
      .default("note")
      .describe("What sort of line this is, which sets its icon."),
    label: text(40).describe("A short label such as Waiting on you, Formula 1 or On this day."),
    text: text(160).describe("One line, under twenty words."),
    href: discoverHrefSchema.optional().describe("Where the line leads, if anywhere."),
  })
  .strict();

const topicCardDraftSchema = z
  .object({
    kind: z.literal("topic"),
    topic: topicSchema,
    title: text(80).describe("A headline for today's angle on the topic."),
    angle: text(240).describe("Two sentences on what is new or worth exploring today."),
    prompt: text(1000).describe("The first message of a chat that explores this angle."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const readCardDraftSchema = z
  .object({
    kind: z.literal("read"),
    topic: topicSchema,
    title: text(160),
    url: externalHttpUrlSchema.describe("The page, exactly as web search returned it."),
    source: text(80).describe("The publication or site name."),
    summary: text(400).describe("What the page says, in one or two sentences."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const actionCardDraftSchema = z
  .object({
    kind: z.literal("action"),
    title: text(100).describe("The thing worth doing, as a short imperative."),
    detail: text(300).describe("What prompted it and what would happen."),
    when: text(60).optional().describe("For a repeat, when it would run, such as Sundays 09:00."),
    prompt: text(1000).describe(
      "The message that starts the work in a chat. Ask for confirmation before installing, sending or spending anything.",
    ),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const resurfaceCardDraftSchema = z
  .object({
    kind: z.literal("resurface"),
    title: text(120).describe("What to look at again, from the list worth resurfacing."),
    detail: text(240).describe("One line on why it is worth a second look today."),
    href: discoverHrefSchema.describe(
      "The link from the list worth resurfacing, exactly as given.",
    ),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const checkInCardDraftSchema = z
  .object({
    kind: z.literal("check_in"),
    question: text(240).describe("A friendly follow-up question about something they mentioned."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const watchCardDraftSchema = z
  .object({
    kind: z.literal("watch"),
    topic: topicSchema,
    title: text(160),
    url: externalHttpUrlSchema.describe("The video, exactly as the context gave it."),
    source: text(80).describe("The channel or service it is on."),
    summary: text(400).describe("What it is and why now, in one or two sentences."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const listenCardDraftSchema = z
  .object({
    kind: z.literal("listen"),
    topic: topicSchema,
    title: text(160),
    url: externalHttpUrlSchema.describe("The episode or album, exactly as the context gave it."),
    source: text(80).describe("The show, artist or service."),
    summary: text(400).describe("What it is and why now, in one or two sentences."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const eventCardDraftSchema = z
  .object({
    kind: z.literal("event"),
    title: text(120).describe("What is happening: an episode airing, a release, a gig, a meeting."),
    when: text(80).describe("When, as a readable day and time."),
    where: text(120).optional().describe("Where, when it has a place or a service."),
    detail: text(300).describe("One or two sentences on what to expect."),
    url: externalHttpUrlSchema.optional().describe("A link, only when the context gave one."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

const inboxCardDraftSchema = z
  .object({
    kind: z.literal("inbox"),
    title: text(160).describe("The subject, tidied."),
    source: text(80).describe("Who sent it."),
    summary: text(400).describe("The one thing worth knowing from it."),
    url: externalHttpUrlSchema.optional().describe("A link from the message, when there is one."),
    reason: reasonSchema,
    sensitive: sensitiveSchema,
  })
  .strict();

export const discoverCardDraftSchema = z.discriminatedUnion("kind", [
  topicCardDraftSchema,
  readCardDraftSchema,
  watchCardDraftSchema,
  listenCardDraftSchema,
  eventCardDraftSchema,
  inboxCardDraftSchema,
  actionCardDraftSchema,
  checkInCardDraftSchema,
  resurfaceCardDraftSchema,
]);

const cardIdentity = { id: z.string().min(1).max(80) };

export const discoverCoverIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,120}$/u, "A cover id is lowercase letters, digits and dashes");

export const discoverCardSchema = z.discriminatedUnion("kind", [
  topicCardDraftSchema.extend({ ...cardIdentity, coverId: discoverCoverIdSchema.optional() }),
  readCardDraftSchema.extend(cardIdentity),
  watchCardDraftSchema.extend(cardIdentity),
  listenCardDraftSchema.extend(cardIdentity),
  eventCardDraftSchema.extend(cardIdentity),
  inboxCardDraftSchema.extend(cardIdentity),
  actionCardDraftSchema.extend(cardIdentity),
  checkInCardDraftSchema.extend(cardIdentity),
  resurfaceCardDraftSchema.extend(cardIdentity),
]);

export const DISCOVER_CARD_KINDS = [
  "topic",
  "read",
  "watch",
  "listen",
  "event",
  "inbox",
  "action",
  "check_in",
  "resurface",
] as const;

export const discoverInterestInferenceSchema = z
  .object({
    interests: z
      .array(topicSchema)
      .min(1)
      .max(5)
      .describe("Three to five interests to research overnight, strongest first."),
  })
  .strict();

export type DiscoverInterestInference = z.infer<typeof discoverInterestInferenceSchema>;

export const composeDiscoverEditionInputSchema = z
  .object({
    greeting: text(80).describe("A short greeting for the top of the page, without their name."),
    interests: z
      .array(discoverInterestSchema)
      .min(1)
      .max(DISCOVER_MAX_INTERESTS)
      .describe("The interests this edition is built around, strongest first."),
    brief: z
      .array(discoverBriefLineSchema)
      .max(DISCOVER_MAX_BRIEF_LINES)
      .describe("The brief at the top of the page, most important first."),
    cards: z
      .array(discoverCardDraftSchema)
      .min(1)
      .max(DISCOVER_MAX_CARDS)
      .describe("The cards, in the order they should appear."),
  })
  .strict();

export const readDiscoverContextInputSchema = z.object({}).strict();

export const discoverEditionContentSchema = z
  .object({
    version: z.literal(DISCOVER_EDITION_VERSION),
    date: z.iso.date(),
    timezone: z.string().min(1),
    greeting: text(80),
    interests: z.array(discoverInterestSchema).max(DISCOVER_MAX_INTERESTS),
    brief: z.array(discoverBriefLineSchema).max(DISCOVER_MAX_BRIEF_LINES),
    cards: z.array(discoverCardSchema).max(DISCOVER_MAX_CARDS),
    listenSourceId: z.string().min(1).optional(),
    episodeId: z.string().min(1).optional(),
    episodeOverBudget: z.boolean().optional(),
    runId: z.string().min(1).optional(),
    episodeFailed: z.boolean().optional(),
    weekSourceId: z.string().min(1).optional(),
    signals: z
      .object({ read: z.array(z.string().min(1)), stale: z.array(z.string().min(1)) })
      .strict()
      .optional(),
    edition: discoverEditionTimeSchema.optional(),
    generatedAt: z.iso.datetime(),
  })
  .strict();

export const DISCOVER_FEEDBACK_SIGNALS = ["more", "less", "hide", "saved", "opened"] as const;

export const discoverFeedbackSignalSchema = z.enum(DISCOVER_FEEDBACK_SIGNALS);

export const discoverEditionSchema = discoverEditionContentSchema.extend({
  id: z.string().min(1),
  feedback: z.record(z.string(), z.array(discoverFeedbackSignalSchema)),
});

export const discoverSettingsSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().nullable(),
  curate: z.string().max(DISCOVER_CURATE_MAX_LENGTH),
  location: z.string().nullable(),
  listen: z.boolean(),
  evening: z.boolean(),
  episode: discoverEpisodeLengthSchema,
  style: videoOverviewStyleSchema,
  notify: z.boolean(),
  sources: z.array(
    z.object({
      providerId: z.string().min(1),
      name: z.string().min(1),
      description: z.string(),
      connected: z.boolean(),
      used: z.boolean(),
      lastReadAt: z.string().nullable(),
      lastError: z.string().nullable(),
    }),
  ),
  installationId: z.string().nullable(),
  episodeCosts: z
    .object({
      short: z.number().int().nonnegative(),
      standard: z.number().int().nonnegative(),
      long: z.number().int().nonnegative(),
    })
    .nullable(),
});

export const updateDiscoverSettingsSchema = z
  .object({
    enabled: z.boolean(),
    timezone: z.string().trim().min(1).max(120).optional(),
    curate: z.string().trim().max(DISCOVER_CURATE_MAX_LENGTH).optional(),
    listen: z.boolean().optional(),
    evening: z.boolean().optional(),
    episode: discoverEpisodeLengthSchema.optional(),
    style: videoOverviewStyleSchema.optional(),
    notify: z.boolean().optional(),
    source: z
      .object({ providerId: z.string().min(1), used: z.boolean() })
      .strict()
      .optional(),
  })
  .strict();

export const DISCOVER_HEALTH_SUMMARY_KIND = "discover.health_summary";

const dailyMinutesSchema = z.number().int().min(0).max(1440).nullable();

export const discoverHealthSummarySchema = z
  .object({
    date: z.iso.date(),
    sleepMinutes: dailyMinutesSchema,
    mindfulMinutes: dailyMinutesSchema,
    exerciseMinutes: dailyMinutesSchema,
  })
  .strict();

export type DiscoverHealthSummary = z.infer<typeof discoverHealthSummarySchema>;

export const discoverFollowSchema = z.object({
  notebookId: z.string().min(1),
  topic: z.string().min(1),
});

export const followDiscoverTopicSchema = z.object({ topic: text(60) }).strict();

export const discoverFollowParamsSchema = z.object({ notebook_id: z.string().min(1) });

export const discoverUnfollowResponseSchema = z.object({ notebookId: z.string().min(1) });

export const discoverResponseSchema = z.object({
  settings: discoverSettingsSchema,
  edition: discoverEditionSchema.nullable(),
  follows: z.array(discoverFollowSchema),
  windDownId: z.string().nullable(),
});

export const discoverSeasonParamsSchema = z.object({ season_id: z.string().min(1) });

export const discoverEditionParamsSchema = z.object({ date: z.iso.date() });

export const discoverFeedbackRequestSchema = z
  .object({
    editionId: z.string().min(1).max(80),
    cardId: z.string().min(1).max(80),
    signal: discoverFeedbackSignalSchema,
  })
  .strict();

export const discoverFeedbackResponseSchema = z.object({
  cardId: z.string().min(1),
  signals: z.array(discoverFeedbackSignalSchema),
});

export const discoverCoverParamsSchema = z.object({ cover_id: discoverCoverIdSchema });

const discoverJobRun = { runId: z.string().min(1).optional() };

export const discoverJobTaskDataSchema = z.discriminatedUnion("job", [
  z.object({ ...discoverJobRun, job: z.literal("covers"), editionId: z.string().min(1) }).strict(),
  z.object({ ...discoverJobRun, job: z.literal("links"), editionId: z.string().min(1) }).strict(),
  z.object({ ...discoverJobRun, job: z.literal("tidy"), today: z.iso.date() }).strict(),
  z.object({ ...discoverJobRun, job: z.literal("gather") }).strict(),
  z
    .object({ ...discoverJobRun, job: z.literal("your_week"), editionId: z.string().min(1) })
    .strict(),
  z
    .object({ ...discoverJobRun, job: z.literal("episode_extras"), episodeId: z.string().min(1) })
    .strict(),
  z.object({ ...discoverJobRun, job: z.literal("listen"), editionId: z.string().min(1) }).strict(),
  z.object({ ...discoverJobRun, job: z.literal("episode"), editionId: z.string().min(1) }).strict(),
  z
    .object({ ...discoverJobRun, job: z.literal("wind_down"), windDownId: z.string().min(1) })
    .strict(),
  z
    .object({ ...discoverJobRun, job: z.literal("season_listen"), seasonId: z.string().min(1) })
    .strict(),
  z
    .object({
      ...discoverJobRun,
      job: z.literal("episode_chapter"),
      episodeId: z.string().min(1),
      chapter: z.number().int().min(0).max(3),
    })
    .strict(),
]);

export const discoverEpisodeResponseSchema = z.object({ episodeId: z.string().min(1) });

export const discoverQueuedResponseSchema = z.object({ queued: z.literal(true) });

export const discoverEditionIdParamsSchema = z.object({ edition_id: z.string().min(1) });

export const discoverListenResponseSchema = z.object({ sourceId: z.string().min(1) });

export const discoverRefreshResponseSchema = z.object({
  status: z.enum(["queued", "blocked", "paused", "not_enabled"]),
  taskId: z.string().nullable(),
});

export type DiscoverInterest = z.infer<typeof discoverInterestSchema>;
export type DiscoverBriefKind = z.infer<typeof discoverBriefKindSchema>;
export type DiscoverBriefLine = z.infer<typeof discoverBriefLineSchema>;
export type DiscoverCardDraft = z.infer<typeof discoverCardDraftSchema>;
export type DiscoverCard = z.infer<typeof discoverCardSchema>;
export type DiscoverCardKind = DiscoverCard["kind"];
export type ComposeDiscoverEditionInput = z.infer<typeof composeDiscoverEditionInputSchema>;
export type ReadDiscoverContextInput = z.infer<typeof readDiscoverContextInputSchema>;
export type DiscoverEditionContent = z.infer<typeof discoverEditionContentSchema>;
export type DiscoverFeedbackSignal = z.infer<typeof discoverFeedbackSignalSchema>;
export type DiscoverEdition = z.infer<typeof discoverEditionSchema>;
export type DiscoverSettings = z.infer<typeof discoverSettingsSchema>;
export type UpdateDiscoverSettings = z.infer<typeof updateDiscoverSettingsSchema>;
export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;
export type DiscoverFeedbackRequest = z.infer<typeof discoverFeedbackRequestSchema>;
export type DiscoverFeedbackResponse = z.infer<typeof discoverFeedbackResponseSchema>;
export type DiscoverRefreshResponse = z.infer<typeof discoverRefreshResponseSchema>;
export type DiscoverFollow = z.infer<typeof discoverFollowSchema>;
export type FollowDiscoverTopic = z.infer<typeof followDiscoverTopicSchema>;
export type DiscoverListenResponse = z.infer<typeof discoverListenResponseSchema>;
export type DiscoverJobTaskData = z.infer<typeof discoverJobTaskDataSchema>;
export type DiscoverEpisodeResponse = z.infer<typeof discoverEpisodeResponseSchema>;

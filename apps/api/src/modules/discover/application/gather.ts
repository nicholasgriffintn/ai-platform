import {
  connectorOperationRequiresApproval,
  getConnectorOperationConfig,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { inlineTaskSteps, type TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import {
  DISCOVER_JOB_TASK_TYPE,
  DISCOVER_RECIPE_ID,
  DISCOVER_RESEARCH_METADATA_KEY,
  DISCOVER_SIGNAL_METADATA_KEY,
  recipeConnectorProviderSchema,
  type DiscoverGatherScope,
} from "@ngriffin_uk/polychat-schemas";
import {
  containsRecordList,
  describeZonedInstant,
  isoDaysBefore,
  sha256Hex,
  zonedTimeToInstant,
} from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import { isDiscoverGatherFresh } from "~/modules/discover/domain/freshness";
import {
  discoverGatherTaskId,
  nextDiscoverGatherSlot,
} from "~/modules/discover/domain/gather-schedule";
import { chooseResearchTopics } from "~/modules/discover/domain/interests";
import {
  listDiscoverCategoryNews,
  matchDiscoverNews,
  pickDiscoverHeadlines,
  selectDiscoverNewsCategories,
} from "~/modules/discover/domain/news-categories";
import {
  DISCOVER_HEADLINES_TOPIC,
  mergeResearchDocument,
  type DiscoverResearchResult,
} from "~/modules/discover/domain/research";
import {
  DISCOVER_SIGNALS,
  isDiscoverFeedSignal,
  listDiscoverFeedSignals,
} from "~/modules/discover/domain/signal-catalogue";
import { renderSignalDocument } from "~/modules/discover/domain/signal-document";
import { selectDiscoverSignals } from "~/modules/discover/domain/signal-selection";
import { DISCOVER_FEED_PROVIDER_ID } from "~/modules/discover/domain/signal-sources/feeds";
import type {
  DiscoverSignal,
  DiscoverSignalRead,
} from "~/modules/discover/domain/signal-sources/types";
import { readKnowledgeText, withKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { findTopicArticles } from "~/modules/knowledge/application/syncs/topics";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { getAssistantRecipe } from "~/modules/recipes/application";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { readDiscoverArticles } from "./articles";
import { topUpDiscoverFeed } from "./feed-top-up";
import { listDiscoverFollows } from "./follows";
import { chooseDiscoverInterests } from "./interests";
import { discoverNewsItemsSchema, readDiscoverNews } from "./news";
import {
  ensureDiscoverNotebook,
  listDiscoverDocuments,
  readDiscoverDocuments,
  type DiscoverDocuments,
} from "./notebook";
import { readDiscoverRoutine, type DiscoverRoutineSettings } from "./settings";
import { discoverSignalSourceId, writeDiscoverDocument } from "./signal-documents";
import { readDiscoverSignalResult } from "./signal-reads";

const logger = getLogger({ prefix: "discover/gather" });
const RESEARCH_RESULT_LIMIT = 8;
const HEADLINE_NEWS_DAYS = 1;
const TOPIC_NEWS_DAYS = 3;
const DISCOVER_NEWS_LANGUAGE = "en";
const CURATE_TOPIC_LIMIT = 4;
const TOPIC_RESEARCH_CONCURRENCY = 3;
const NEWS_TOPIC_MIN_MATCHES = 3;

export interface DiscoverGatherSummary {
  read: string[];
  stale: string[];
  topics: string[];
  added: number;
}

function supportsSignal(providerId: string, operation: string): boolean {
  const provider = recipeConnectorProviderSchema.safeParse(providerId);

  if (!provider.success) {
    return false;
  }

  const config = getConnectorOperationConfig(provider.data, operation);

  return (
    config?.access === "read" &&
    !config.destructive &&
    !connectorOperationRequiresApproval(provider.data, operation)
  );
}

export async function listConnectedDiscoverProviders(
  context: ServiceContext,
): Promise<Set<string>> {
  const recipe = await getAssistantRecipe(DISCOVER_RECIPE_ID, {
    context,
    userId: context.requireUser().id,
  });

  return new Set(
    (recipe?.integrations ?? [])
      .filter((integration) => integration.connectionStatus === "connected")
      .map((integration) => integration.providerId),
  );
}

export async function resolveDiscoverSignals(
  context: ServiceContext,
  settings: Pick<
    DiscoverRoutineSettings,
    "location" | "excludedProviders" | "includedProviders" | "feeds"
  >,
) {
  return selectDiscoverSignals({
    signals: [...DISCOVER_SIGNALS, ...listDiscoverFeedSignals(settings.feeds)],
    connectedProviders: await listConnectedDiscoverProviders(context),
    excludedProviders: new Set(settings.excludedProviders),
    includedProviders: new Set([...settings.includedProviders, DISCOVER_FEED_PROVIDER_ID]),
    supports: supportsSignal,
    hasLocation: Boolean(settings.location),
  });
}

export function curateTopics(curate: string): string[] {
  return curate
    .split(/[\n;]+/u)
    .map((line) => line.replace(/^[-*\d.)\s]+/u, "").trim())
    .filter((line) => line.length > 2 && line.length <= 120)
    .slice(0, CURATE_TOPIC_LIMIT);
}

async function researchSourceId(userId: number, topic: string): Promise<string> {
  return `discover_research_${(await sha256Hex(`${userId}:${discoverTopicKey(topic)}`)).slice(0, 24)}`;
}

async function readSignal(
  context: ServiceContext,
  notebookId: string,
  signal: DiscoverSignal,
  read: DiscoverSignalRead,
): Promise<boolean> {
  const user = context.requireUser();
  const sourceId = await discoverSignalSourceId(user.id, signal.id);
  const readAt = new Date().toISOString();

  try {
    const result = await readDiscoverSignalResult(context, signal, read);
    const lines = signal.digest(result);
    const feedItems = signal.items?.(result, read) ?? [];

    if (lines.length === 0 && feedItems.length === 0 && containsRecordList(result)) {
      throw new AssistantError(
        `${signal.title} answered, but its reply was not in the shape Discover reads`,
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    await writeDiscoverDocument(context, notebookId, {
      id: sourceId,
      origin: "connector",
      kind: "connector",
      title: signal.title,
      provider: signal.providerId,
      content: renderSignalDocument({
        title: signal.title,
        readAt,
        lines,
        error: null,
      }),
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signal.id,
        providerId: signal.providerId,
        readAt,
        attemptedAt: readAt,
        error: null,
        lines,
        items: feedItems,
      },
    });

    return true;
  } catch (error) {
    const message = getErrorMessage(error, "This service could not be read");

    logger.warn("A Discover signal could not be read", {
      signal: signal.id,
      error_message: message,
    });
    const existing = await context.repositories.get(SourceRepository).getSource(sourceId);

    await writeDiscoverDocument(context, notebookId, {
      id: sourceId,
      origin: "connector",
      kind: "connector",
      title: signal.title,
      provider: signal.providerId,
      content: existing?.content
        ? undefined
        : renderSignalDocument({
            title: signal.title,
            readAt: null,
            lines: [],
            error: message,
          }),
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signal.id,
        providerId: signal.providerId,
        readAt: null,
        attemptedAt: readAt,
        error: message.slice(0, 200),
        lines: [],
        items: [],
      },
    }).catch((writeError: unknown) => {
      logger.warn("A Discover signal error could not be recorded", {
        signal: signal.id,
        error_message: getErrorMessage(writeError),
      });
    });

    return false;
  }
}

function headlinesQuery(location: string | null): string {
  return location ? `${location} news` : "world news";
}

interface ResearchRequest {
  topic: string;
  date: string;
  country: string | null;
  query?: string;
  days?: number;
  candidates?: readonly DiscoverResearchResult[];
}

async function researchTopic(
  context: ServiceContext,
  notebookId: string,
  { topic, date, country, query = topic, days = TOPIC_NEWS_DAYS, candidates }: ResearchRequest,
): Promise<boolean> {
  const user = context.requireUser();
  const sourceId = await researchSourceId(user.id, topic);
  const attemptedAt = new Date().toISOString();

  try {
    const found =
      candidates ??
      (await findTopicArticles(
        context,
        { userId: user.id, projectId: null },
        {
          kind: "news",
          query,
          days,
          country,
          language: DISCOVER_NEWS_LANGUAGE,
          limit: RESEARCH_RESULT_LIMIT,
        },
      ));
    const results = await readDiscoverArticles(context, notebookId, {
      topic,
      date,
      results: found,
    });
    const existing = await context.repositories.get(SourceRepository).getSource(sourceId);

    await writeDiscoverDocument(context, notebookId, {
      id: sourceId,
      origin: "research",
      kind: "text",
      title: `Research: ${topic}`.slice(0, 200),
      provider: "web",
      content: mergeResearchDocument(existing ? await readKnowledgeText(context, existing) : "", {
        date,
        results,
      }),
      metadata: {
        [DISCOVER_RESEARCH_METADATA_KEY]: topic,
        attemptedAt,
        ...(results.length > 0
          ? { readAt: attemptedAt, error: null }
          : { error: `No news on this in the last ${days} days` }),
      },
    });

    return results.length > 0;
  } catch (error) {
    const message = getErrorMessage(error, "This topic could not be researched");

    logger.warn("A Discover topic could not be researched", { topic, error_message: message });
    await writeDiscoverDocument(context, notebookId, {
      id: sourceId,
      origin: "research",
      kind: "text",
      title: `Research: ${topic}`.slice(0, 200),
      provider: "web",
      content: undefined,
      metadata: {
        [DISCOVER_RESEARCH_METADATA_KEY]: topic,
        attemptedAt,
        error: message.slice(0, 200),
      },
    }).catch((writeError: unknown) => {
      logger.warn("A Discover research error could not be recorded", {
        topic,
        error_message: getErrorMessage(writeError),
      });
    });

    return false;
  }
}

export async function listDiscoverTopics(
  context: ServiceContext,
  curate: string,
): Promise<string[]> {
  const follows = await listDiscoverFollows(context, context.requireUser().id);
  const seen = new Set<string>();
  const topics: string[] = [];

  for (const topic of [...follows.map((follow) => follow.topic), ...curateTopics(curate)]) {
    const key = discoverTopicKey(topic);

    if (!seen.has(key)) {
      seen.add(key);
      topics.push(topic);
    }
  }

  return topics;
}

async function listSignalTopics(
  context: ServiceContext,
  notebookId: string,
  input: { curate: string; today: string; now: Date },
): Promise<string[]> {
  const [follows, interests] = await Promise.all([
    listDiscoverFollows(context, context.requireUser().id),
    chooseDiscoverInterests(context, notebookId, {
      today: input.today,
      now: input.now,
      refresh: false,
    }),
  ]);

  return chooseResearchTopics({
    followed: follows.map((follow) => follow.topic),
    asked: curateTopics(input.curate),
    more: interests.more,
    inferred: interests.ranked,
    hidden: interests.hidden,
  });
}

export async function runDiscoverGather(
  context: ServiceContext,
  {
    now = new Date(),
    scope = "full",
    steps = inlineTaskSteps,
  }: { now?: Date; scope?: DiscoverGatherScope; steps?: TaskSteps } = {},
): Promise<DiscoverGatherSummary> {
  const settings = await readDiscoverRoutine(context);

  if (!settings.enabled) {
    return { read: [], stale: [], topics: [], added: 0 };
  }

  const timezone = settings.timezone ?? "UTC";
  const zoned = describeZonedInstant(now, timezone);
  const notebookId = await steps.value(
    "notebook",
    z.string(),
    async () => (await ensureDiscoverNotebook(context)).id,
  );
  const { selected: available } = await resolveDiscoverSignals(context, settings);
  const selected = scope === "full" ? available : available.filter(isDiscoverFeedSignal);
  const read: string[] = [];
  const stale: string[] = [];
  let topics: string[] = [];
  let added = 0;

  try {
    const signalTopics =
      selected.length > 0
        ? await steps.value("signal-topics", z.array(z.string()), () =>
            listSignalTopics(context, notebookId, {
              curate: settings.curate,
              today: zoned.date,
              now,
            }),
          )
        : [];

    for (const signal of selected) {
      if (signal.needsTopics && signalTopics.length === 0) {
        continue;
      }

      const ok = await steps.value(`signal-${signal.id}`, z.boolean(), async () => {
        try {
          return await readSignal(context, notebookId, signal, {
            date: zoned.date,
            timezone,
            now,
            location: settings.location,
            topics: signalTopics,
          });
        } finally {
          await closeComposioConnectorRun(context);
        }
      });

      (ok ? read : stale).push(signal.providerId);
    }

    const newsCategories = selectDiscoverNewsCategories(settings.newsCategoryIds);
    const news =
      newsCategories.length > 0
        ? await steps.value("news", discoverNewsItemsSchema, () => readDiscoverNews(newsCategories))
        : [];
    const headlineSince = isoDaysBefore(now, HEADLINE_NEWS_DAYS);
    const topicSince = isoDaysBefore(now, TOPIC_NEWS_DAYS);

    await steps.run("headlines", async () => {
      await researchTopic(context, notebookId, {
        topic: DISCOVER_HEADLINES_TOPIC,
        date: zoned.date,
        country: settings.country,
        query: headlinesQuery(settings.location),
        days: HEADLINE_NEWS_DAYS,
        ...(news.length > 0
          ? {
              candidates: pickDiscoverHeadlines(news, {
                since: headlineSince,
                limit: RESEARCH_RESULT_LIMIT,
              }),
            }
          : {}),
      });
    });

    await mapWithConcurrency(newsCategories, TOPIC_RESEARCH_CONCURRENCY, (category) =>
      steps.run(`news-${category.id}`, async () => {
        await researchTopic(context, notebookId, {
          topic: category.topic,
          date: zoned.date,
          country: settings.country,
          candidates: listDiscoverCategoryNews(news, {
            category: category.id,
            since: topicSince,
            limit: RESEARCH_RESULT_LIMIT,
          }),
        });
      }),
    );

    topics = await steps.value("topics", z.array(z.string()), async () => {
      const follows = await listDiscoverFollows(context, context.requireUser().id);
      const interests = await chooseDiscoverInterests(context, notebookId, {
        today: zoned.date,
        now,
        refresh: scope === "full",
      });

      return chooseResearchTopics({
        followed: follows.map((follow) => follow.topic),
        asked: curateTopics(settings.curate),
        more: interests.more,
        inferred: interests.ranked,
        hidden: interests.hidden,
      });
    });

    await mapWithConcurrency(topics, TOPIC_RESEARCH_CONCURRENCY, (topic, index) =>
      steps.run(`topic-${index}`, async () => {
        const matched = matchDiscoverNews(topic, news, {
          since: topicSince,
          limit: RESEARCH_RESULT_LIMIT,
        });

        await researchTopic(context, notebookId, {
          topic,
          date: zoned.date,
          country: settings.country,
          ...(matched.length >= NEWS_TOPIC_MIN_MATCHES ? { candidates: matched } : {}),
        });
      }),
    );

    added = await steps.value("feed", z.number(), () =>
      topUpDiscoverFeed(context, { today: zoned.date, curate: settings.curate }),
    );
  } finally {
    await steps.run("schedule-next", () =>
      scheduleNextDiscoverGather(context, settings, zoned, timezone),
    );
  }

  return { read: [...new Set(read)], stale: [...new Set(stale)], topics, added };
}

export async function ensureDiscoverGathered(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverDocuments> {
  const user = context.requireUser();
  const settings = await readDiscoverRoutine(context);
  const [documents, { selected }] = await Promise.all([
    listDiscoverDocuments(context, user.id),
    resolveDiscoverSignals(context, settings),
  ]);

  if (
    isDiscoverGatherFresh({
      signals: documents.signals,
      research: documents.research,
      expectedSignals: selected.length,
      now: now.getTime(),
    })
  ) {
    return documents;
  }

  await runDiscoverGather(context, { now });

  const notebook = await ensureDiscoverNotebook(context);

  return readDiscoverDocuments(
    await withKnowledgeText(
      context,
      await context.repositories.get(SourceRepository).listCollectionSources(notebook.id),
    ),
  );
}

async function scheduleNextDiscoverGather(
  context: ServiceContext,
  settings: Pick<DiscoverRoutineSettings, "evening">,
  zoned: { date: string; time: string },
  timezone: string,
): Promise<void> {
  const user = context.requireUser();
  const slot = nextDiscoverGatherSlot({
    date: zoned.date,
    hour: Number.parseInt(zoned.time.slice(0, 2), 10),
    evening: settings.evening,
  });

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: discoverGatherTaskId(user.id, slot),
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: user.id,
    task_data: { job: "gather", scope: slot.scope },
    schedule_type: "scheduled",
    scheduled_at: zonedTimeToInstant(slot.date, slot.hour, timezone).toISOString(),
    priority: 6,
  });
}

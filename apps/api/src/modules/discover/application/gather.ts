import {
  connectorOperationRequiresApproval,
  getConnectorOperationConfig,
} from "@ngriffin_uk/polychat-ai-integrations";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  discoverInterestInferenceSchema,
  DISCOVER_GATHER_HOUR,
  DISCOVER_JOB_TASK_TYPE,
  DISCOVER_RECIPE_ID,
  DISCOVER_RESEARCH_METADATA_KEY,
  DISCOVER_SIGNAL_METADATA_KEY,
  recipeConnectorProviderSchema,
} from "@ngriffin_uk/polychat-schemas";
import {
  describeZonedInstant,
  shiftCalendarDate,
  sha256Hex,
  truncateForModel,
  zonedTimeToInstant,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/connectors/application/operations";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { isDiscoverGatherFresh } from "~/modules/discover/domain/freshness";
import {
  chooseResearchTopics,
  describeInterestMaterial,
} from "~/modules/discover/domain/interests";
import { mergeResearchDocument } from "~/modules/discover/domain/research";
import { DISCOVER_SIGNALS, type DiscoverSignal } from "~/modules/discover/domain/signal-catalogue";
import { renderSignalDocument } from "~/modules/discover/domain/signal-document";
import { selectDiscoverSignals } from "~/modules/discover/domain/signal-selection";
import { findWebResults } from "~/modules/notebooks/application/research";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { getAssistantRecipe } from "~/modules/recipes/application";
import { createSource, updateSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { listRecentDiscoverChatTitles, readMemorySummary } from "./context";
import { listRecentDiscoverEditions } from "./editions";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { generateDiscoverObject } from "./generate";
import {
  ensureDiscoverNotebook,
  listDiscoverDocuments,
  readDiscoverDocuments,
  type DiscoverDocuments,
} from "./notebook";
import { readDiscoverRoutine, type DiscoverRoutineSettings } from "./settings";

const logger = getLogger({ prefix: "discover/gather" });
const SIGNAL_CONTENT_LIMIT = 120_000;
const RESEARCH_RESULT_LIMIT = 8;
const CURATE_TOPIC_LIMIT = 4;

export interface DiscoverGatherSummary {
  read: string[];
  stale: string[];
  topics: string[];
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
  settings: Pick<DiscoverRoutineSettings, "location" | "excludedProviders">,
) {
  return selectDiscoverSignals({
    signals: DISCOVER_SIGNALS,
    connectedProviders: await listConnectedDiscoverProviders(context),
    excludedProviders: new Set(settings.excludedProviders),
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

async function signalSourceId(userId: number, signalId: string): Promise<string> {
  return `discover_signal_${(await sha256Hex(`${userId}:${signalId}`)).slice(0, 24)}`;
}

async function researchSourceId(userId: number, topic: string): Promise<string> {
  return `discover_research_${(await sha256Hex(`${userId}:${discoverTopicKey(topic)}`)).slice(0, 24)}`;
}

async function upsertDocument(
  context: ServiceContext,
  notebookId: string,
  input: {
    id: string;
    kind: "connector" | "text";
    title: string;
    provider: string | null;
    content: string | undefined;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const user = context.requireUser();
  const sources = context.repositories.get(SourceRepository);
  const existing = await sources.getSource(input.id);

  if (existing && existing.created_by_user_id === user.id) {
    await updateSource(context, user.id, input.id, {
      title: input.title,
      status: "available",
      metadata: input.metadata,
      ...(input.content === undefined ? {} : { content: input.content }),
    });
  } else {
    await createSource(
      context,
      user.id,
      {
        projectId: null,
        kind: input.kind,
        title: input.title,
        status: "available",
        content: input.content ?? "",
        provider: input.provider,
        metadata: input.metadata,
      },
      { id: input.id },
    );
  }

  await sources.addCollectionSources(notebookId, [input.id]);
}

async function readSignal(
  context: ServiceContext,
  notebookId: string,
  signal: DiscoverSignal,
  read: Parameters<DiscoverSignal["parameters"]>[0],
): Promise<boolean> {
  const user = context.requireUser();
  const sourceId = await signalSourceId(user.id, signal.id);
  const readAt = new Date().toISOString();

  try {
    const result = await executeRecipeConnectorOperation({
      context,
      userId: user.id,
      request: {
        provider: recipeConnectorProviderSchema.parse(signal.providerId),
        operation: signal.operation,
        params: signal.parameters(read),
      },
      scope: {
        completionId: context.connectorRunId,
        conversationId: null,
        recipeId: DISCOVER_RECIPE_ID,
      },
    });
    const lines = signal.digest(result);

    await upsertDocument(context, notebookId, {
      id: sourceId,
      kind: "connector",
      title: signal.title,
      provider: signal.providerId,
      content: renderSignalDocument({
        title: signal.title,
        readAt,
        lines,
        error: null,
        raw: truncateForModel(JSON.stringify(result, null, 1) ?? "", SIGNAL_CONTENT_LIMIT),
      }),
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signal.id,
        providerId: signal.providerId,
        readAt,
        error: null,
        lines,
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

    await upsertDocument(context, notebookId, {
      id: sourceId,
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
            raw: null,
          }),
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signal.id,
        providerId: signal.providerId,
        readAt: null,
        attemptedAt: readAt,
        error: message.slice(0, 200),
        lines: [],
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

async function researchTopic(
  context: ServiceContext,
  notebookId: string,
  topic: string,
  date: string,
): Promise<boolean> {
  const user = context.requireUser();
  const sourceId = await researchSourceId(user.id, topic);

  try {
    const results = (await findWebResults(context, `${topic} latest news`)).slice(
      0,
      RESEARCH_RESULT_LIMIT,
    );
    const existing = await context.repositories.get(SourceRepository).getSource(sourceId);

    await upsertDocument(context, notebookId, {
      id: sourceId,
      kind: "text",
      title: `Research: ${topic}`.slice(0, 200),
      provider: "web",
      content: mergeResearchDocument(existing?.content ?? "", { date, results }),
      metadata: {
        [DISCOVER_RESEARCH_METADATA_KEY]: topic,
        readAt: new Date().toISOString(),
      },
    });

    return true;
  } catch (error) {
    logger.warn("A Discover topic could not be researched", {
      topic,
      error_message: getErrorMessage(error),
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

async function inferDiscoverInterests(
  context: ServiceContext,
  notebookId: string,
  now: Date,
): Promise<{ inferred: string[]; more: string[]; hidden: string[] }> {
  const user = context.requireUser();
  const [sources, chatTitles, memorySummary, feedback, [latest]] = await Promise.all([
    context.repositories.get(SourceRepository).listCollectionSources(notebookId),
    listRecentDiscoverChatTitles(context, user.id, now.getTime()),
    readMemorySummary(context, user.id),
    listDiscoverFeedback(context, user.id),
    listRecentDiscoverEditions(context, user.id, 1),
  ]);
  const summary = summariseDiscoverFeedback(feedback);
  const signals = readDiscoverDocuments(sources).signals.filter(
    (document) => !document.error && document.lines.length > 0,
  );
  const hidden = [...summary.hiddenTopics, ...summary.lessTopics];

  try {
    const { interests } = await generateDiscoverObject(context, {
      name: "discover_interests",
      schema: discoverInterestInferenceSchema,
      system: renderPrompt("discover/interests"),
      material: describeInterestMaterial({
        signals,
        chatTitles,
        memorySummary,
        more: summary.moreTopics,
        less: hidden,
        previous: latest?.content.interests.map((interest) => interest.topic) ?? [],
      }),
    });

    return { inferred: interests, more: summary.moreTopics, hidden };
  } catch (error) {
    logger.warn("Discover interests could not be inferred", {
      error_message: getErrorMessage(error),
    });

    return { inferred: [], more: summary.moreTopics, hidden };
  }
}

export async function runDiscoverGather(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverGatherSummary> {
  const settings = await readDiscoverRoutine(context);
  const timezone = settings.timezone ?? "UTC";
  const zoned = describeZonedInstant(now, timezone);
  const notebook = await ensureDiscoverNotebook(context);
  const { selected } = await resolveDiscoverSignals(context, settings);
  const read: string[] = [];
  const stale: string[] = [];
  let topics: string[] = [];

  try {
    for (const signal of selected) {
      const ok = await readSignal(context, notebook.id, signal, {
        date: zoned.date,
        timezone,
        now,
        location: settings.location,
      });

      (ok ? read : stale).push(signal.providerId);
    }

    const follows = await listDiscoverFollows(context, context.requireUser().id);
    const interests = await inferDiscoverInterests(context, notebook.id, now);

    topics = chooseResearchTopics({
      followed: follows.map((follow) => follow.topic),
      asked: curateTopics(settings.curate),
      more: interests.more,
      inferred: interests.inferred,
      hidden: interests.hidden,
    });

    for (const topic of topics) {
      await researchTopic(context, notebook.id, topic, zoned.date);
    }
  } finally {
    await closeComposioConnectorRun(context);
  }

  return { read: [...new Set(read)], stale: [...new Set(stale)], topics };
}

export async function ensureDiscoverGathered(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverDocuments> {
  const user = context.requireUser();
  const settings = await readDiscoverRoutine(context);
  const [topics, documents, { selected }] = await Promise.all([
    listDiscoverTopics(context, settings.curate),
    listDiscoverDocuments(context, user.id),
    resolveDiscoverSignals(context, settings),
  ]);

  if (
    isDiscoverGatherFresh({
      signals: documents.signals,
      research: documents.research,
      topics,
      expectedSignals: selected.length,
      now: now.getTime(),
    })
  ) {
    return documents;
  }

  await runDiscoverGather(context, now);

  const notebook = await ensureDiscoverNotebook(context);

  return readDiscoverDocuments(
    await context.repositories.get(SourceRepository).listCollectionSources(notebook.id),
  );
}

export async function scheduleNextDiscoverGather(
  context: ServiceContext,
  date: string,
  timezone: string,
): Promise<void> {
  const user = context.requireUser();
  const nextDate = shiftCalendarDate(date, 1);

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: `discover_gather_${user.id}_${nextDate}`,
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: user.id,
    task_data: { job: "gather" },
    schedule_type: "scheduled",
    scheduled_at: zonedTimeToInstant(nextDate, DISCOVER_GATHER_HOUR, timezone).toISOString(),
    priority: 6,
  });
}

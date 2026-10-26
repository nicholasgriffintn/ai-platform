import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_ARTICLE_METADATA_KEY,
  DISCOVER_BRIEFING_METADATA_KEY,
  discoverBriefingDraftSchema,
} from "@ngriffin_uk/polychat-schemas";
import {
  generateId,
  isRecord,
  readUrlHost,
  sha256Hex,
  truncateForModel,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  addResearchedReads,
  buildDiscoverBriefingMaterial,
  describeBriefingLeads,
  listBriefingReads,
  planEditionResearch,
  renderDiscoverBriefing,
  type DiscoverBriefingArticle,
  type DiscoverBriefingText,
} from "~/modules/discover/domain/briefing";
import { discoverTopicKey, listEditionLinks } from "~/modules/discover/domain/edition";
import { pickEpisodeTopic } from "~/modules/discover/domain/episodes";
import { DISCOVER_HEADLINES_TOPIC } from "~/modules/discover/domain/research";
import { DISCOVER_MODEL_TIER } from "~/modules/discover/domain/settings";
import {
  gatherKnowledgeArticles,
  type GatheredArticle,
} from "~/modules/knowledge/application/intake/articles";
import { withKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { findTopicArticles } from "~/modules/knowledge/application/syncs/topics";
import type { KnowledgeArticleCandidate } from "~/modules/knowledge/domain/item";
import { generateTierObject } from "~/modules/models/application/tier-object";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { affordableEpisodeLength, canAffordDiscoverListen } from "./cost";
import {
  listRecentDiscoverEditions,
  requireDiscoverEdition,
  updateDiscoverEdition,
  withEditionRun,
  type StoredDiscoverEdition,
} from "./editions";
import { listDiscoverFollows } from "./follows";
import { enqueueDiscoverJob } from "./jobs";
import { ensureDiscoverNotebook } from "./notebook";
import { readDiscoverRoutine } from "./settings";
import { discoverKnowledgeTarget, writeDiscoverDocument } from "./signal-documents";

const logger = getLogger({ prefix: "discover/briefings" });
const SEARCH_RESULT_LIMIT = 5;
const PAGE_READ_LIMIT = 4;
const NEWS_DAYS = 7;
const ARTICLE_LIMIT = 8;
const ARTICLE_CHARACTERS = 8_000;
const MIN_ARTICLE_CHARACTERS = 400;
const NEWS_LANGUAGE = "en";
const RECENT_EDITION_LIMIT = 7;

export interface DiscoverBriefing extends DiscoverBriefingText {
  sourceId: string;
  articleIds: string[];
}

async function briefingSourceId(userId: number, topic: string): Promise<string> {
  return `discover_briefing_${(await sha256Hex(`${userId}:${discoverTopicKey(topic)}`)).slice(0, 24)}`;
}

function readBriefingMetadata(metadata: Record<string, unknown>) {
  const value = metadata[DISCOVER_BRIEFING_METADATA_KEY];

  return isRecord(value) && typeof value.editionId === "string"
    ? {
        editionId: value.editionId,
        articleIds: Array.isArray(value.articleIds)
          ? value.articleIds.filter((id): id is string => typeof id === "string")
          : [],
      }
    : null;
}

export async function readDiscoverBriefing(
  context: ServiceContext,
  editionId: string,
  topic: string,
): Promise<DiscoverBriefing | null> {
  const user = context.requireUser();
  const sourceId = await briefingSourceId(user.id, topic);
  const source = await context.repositories.get(SourceRepository).getSource(sourceId);

  if (!source || source.created_by_user_id !== user.id) {
    return null;
  }

  const stored = readBriefingMetadata(parseJsonRecord(source.metadata));
  const [withText] = await withKnowledgeText(context, [source]);
  const content = withText?.content?.trim();

  return stored?.editionId === editionId && content
    ? { topic, sourceId, content, articleIds: stored.articleIds }
    : null;
}

async function searchDeeper(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
  topic: string,
  country: string | null,
): Promise<KnowledgeArticleCandidate[]> {
  const user = context.requireUser();
  const searches = [
    ...describeBriefingLeads(edition.content, topic).map((lead) => ({
      kind: "news" as const,
      query: lead.title,
      days: NEWS_DAYS,
    })),
    ...(discoverTopicKey(topic) === discoverTopicKey(DISCOVER_HEADLINES_TOPIC)
      ? []
      : [{ kind: "web" as const, query: topic, days: NEWS_DAYS }]),
  ];
  const found: KnowledgeArticleCandidate[] = [];

  for (const search of searches) {
    try {
      found.push(
        ...(await findTopicArticles(
          context,
          { userId: user.id, projectId: null },
          { ...search, country, language: NEWS_LANGUAGE, limit: SEARCH_RESULT_LIMIT },
        )),
      );
    } catch (error) {
      logger.warn("A Discover briefing search failed", {
        topic,
        error_message: getErrorMessage(error),
      });
    }
  }

  return found;
}

async function readArticles(
  context: ServiceContext,
  sourceIds: readonly string[],
): Promise<(DiscoverBriefingArticle & { sourceId: string })[]> {
  const user = context.requireUser();
  const records = await context.repositories
    .get(SourceRepository)
    .getSourcesByIds([...new Set(sourceIds)]);
  const owned = records.filter(
    (source) => source.created_by_user_id === user.id && source.project_id === null,
  );
  const byId = new Map(
    (await withKnowledgeText(context, owned)).map((source) => [source.id, source]),
  );

  return [...new Set(sourceIds)].flatMap((sourceId) => {
    const source = byId.get(sourceId);
    const content = source?.content?.trim() ?? "";

    if (!source || content.length < MIN_ARTICLE_CHARACTERS) {
      return [];
    }

    const origin = parseJsonRecord(source.metadata).source;

    return [
      {
        sourceId,
        source:
          typeof origin === "string" && origin
            ? origin
            : readUrlHost(source.external_uri ?? "") || "the web",
        title: source.title,
        content: truncateForModel(content, ARTICLE_CHARACTERS),
      },
    ];
  });
}

async function addResearchedLinks(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
  topic: string,
  deeper: readonly GatheredArticle[],
  articles: readonly { sourceId: string }[],
): Promise<void> {
  const readable = new Set(articles.map((article) => article.sourceId));
  const found = deeper.flatMap(({ sourceId, ...item }) =>
    sourceId && readable.has(sourceId) ? [{ ...item, sourceId }] : [],
  );

  if (found.length === 0) {
    return;
  }

  try {
    const recent = await listRecentDiscoverEditions(
      context,
      context.requireUser().id,
      RECENT_EDITION_LIMIT,
    );
    const seenLinks = listEditionLinks(
      recent.filter((other) => other.id !== edition.id).map((other) => other.content),
    );

    await updateDiscoverEdition(context, edition.id, (content) =>
      addResearchedReads({ edition: content, topic, found, seenLinks, createId: generateId }),
    );
  } catch (error) {
    logger.warn("Researched links could not be added to the edition", {
      topic,
      error_message: getErrorMessage(error),
    });
  }
}

async function researchBriefing(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
  topic: string,
  notebookId: string,
  country: string | null,
): Promise<DiscoverBriefing | null> {
  const user = context.requireUser();
  const reads = listBriefingReads(edition.content, topic);
  const deeper = await gatherKnowledgeArticles(
    context,
    await discoverKnowledgeTarget(context, notebookId),
    await searchDeeper(context, edition, topic, country),
    {
      origin: "page",
      readLimit: PAGE_READ_LIMIT,
      summarise: false,
      metadata: () => ({
        [DISCOVER_ARTICLE_METADATA_KEY]: { topic, date: edition.content.date },
      }),
    },
  );
  const articles = (
    await readArticles(context, [
      ...reads.flatMap((card) => (card.sourceId ? [card.sourceId] : [])),
      ...deeper.flatMap((article) => (article.sourceId ? [article.sourceId] : [])),
    ])
  ).slice(0, ARTICLE_LIMIT);

  await addResearchedLinks(context, edition, topic, deeper, articles);

  if (articles.length === 0) {
    return null;
  }

  const briefing = await generateTierObject(withEditionRun(context, edition), {
    tier: DISCOVER_MODEL_TIER,
    name: "discover_briefing",
    schema: discoverBriefingDraftSchema,
    system: renderPrompt("discover/briefing", { topic }),
    material: buildDiscoverBriefingMaterial(topic, articles),
  });
  const sourceId = await briefingSourceId(user.id, topic);
  const content = renderDiscoverBriefing(topic, briefing);
  const articleIds = articles.map((article) => article.sourceId);

  await writeDiscoverDocument(context, notebookId, {
    id: sourceId,
    origin: "research",
    kind: "text",
    title: `Briefing: ${topic}`.slice(0, 200),
    provider: null,
    content,
    metadata: {
      [DISCOVER_BRIEFING_METADATA_KEY]: {
        topic,
        editionId: edition.id,
        date: edition.content.date,
        articleIds,
      },
    },
  });

  return { topic, sourceId, content, articleIds };
}

export async function ensureDiscoverBriefings(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
  topics: readonly string[],
): Promise<DiscoverBriefing[]> {
  const briefings: DiscoverBriefing[] = [];
  let research: { notebookId: string; country: string | null } | null = null;

  for (const topic of topics) {
    try {
      const existing = await readDiscoverBriefing(context, edition.id, topic);

      if (existing) {
        briefings.push(existing);
        continue;
      }

      research ??= {
        notebookId: (await ensureDiscoverNotebook(context)).id,
        country: (await readDiscoverRoutine(context)).country,
      };

      const made = await researchBriefing(
        context,
        edition,
        topic,
        research.notebookId,
        research.country,
      );

      if (made) {
        briefings.push(made);
      }
    } catch (error) {
      logger.warn("A Discover topic could not be researched for a briefing", {
        topic,
        error_message: getErrorMessage(error),
      });
    }
  }

  return briefings;
}

export async function researchDiscoverEdition(
  context: ServiceContext,
  editionId: string,
  next: readonly ("listen" | "episode")[],
): Promise<number> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  let researched = 0;

  try {
    const [follows, routine] = await Promise.all([
      listDiscoverFollows(context, user.id),
      readDiscoverRoutine(context),
    ]);
    const listen =
      next.includes("listen") && (await canAffordDiscoverListen(context, routine.installationId));
    const episode =
      next.includes("episode") &&
      routine.episode !== "off" &&
      (await affordableEpisodeLength(context, routine.installationId, routine.episode)) !== null;
    const topics = planEditionResearch({
      edition: edition.content,
      listen,
      episodeTopic: episode ? pickEpisodeTopic(edition.content, follows) : null,
    });

    researched = (await ensureDiscoverBriefings(context, edition, topics)).length;
  } catch (error) {
    logger.warn("The edition's topics could not be researched", {
      edition_id: editionId,
      error_message: getErrorMessage(error),
    });
  }

  for (const job of next) {
    await enqueueDiscoverJob(withEditionRun(context, edition), { job, editionId });
  }

  return researched;
}

import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { KNOWLEDGE_FEED_METADATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS, isRecord, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";
import { toFtsAllTermsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findNewsResults, findWebResults } from "~/modules/search/application/results";
import {
  dedupeArticleCandidates,
  type KnowledgeArticleCandidate,
  type KnowledgeTarget,
} from "~/modules/sources/domain/knowledge/item";
import {
  KNOWLEDGE_TOPIC_LINEUPS,
  shouldRunTopicStep,
  type KnowledgeTopicStep,
} from "~/modules/sources/domain/knowledge/lineup";
import { readSourceSummary } from "~/modules/sources/domain/summary";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";

const logger = getLogger({ prefix: "sources/knowledge-topics" });

export interface KnowledgeTopicSearch {
  kind: "news" | "web";
  query: string;
  days: number;
  country: string | null;
  language?: string;
  limit: number;
}

type Scope = Pick<KnowledgeTarget, "userId" | "projectId">;

async function findFeedArticles(
  context: ServiceContext,
  scope: Scope,
  search: KnowledgeTopicSearch,
): Promise<KnowledgeArticleCandidate[]> {
  const query = toFtsAllTermsQuery(search.query);

  if (!query) {
    return [];
  }

  const sources = context.repositories.get(SourceRepository);
  const ids = await sources.listFeedArticleIds(
    scope,
    new Date(Date.now() - search.days * DAY_MS).toISOString(),
  );

  if (ids.length === 0) {
    return [];
  }

  const passages = await context.repositories.get(SourceSearchRepository).lexical(
    {
      userId: scope.userId,
      projectId: scope.projectId ?? undefined,
      sourceIds: ids.map((row) => row.id),
    },
    query,
    "url",
  );
  const ranked = [...new Set(passages.map((passage) => passage.sourceId))].slice(0, search.limit);
  const byId = new Map(
    (await sources.getSourcesByIds(ranked)).map((source) => [source.id, source]),
  );

  return ranked.flatMap((id) => {
    const source = byId.get(id);

    if (!source?.external_uri) {
      return [];
    }

    const metadata = parseJsonRecord(source.metadata);
    const feed = metadata[KNOWLEDGE_FEED_METADATA_KEY];
    const publishedAt = isRecord(feed) ? readNonEmptyString(feed.publishedAt) : undefined;
    const origin = readNonEmptyString(metadata.source);

    return [
      {
        title: source.title,
        url: source.external_uri,
        snippet: readSourceSummary(metadata)?.summary ?? "",
        ...(origin ? { source: origin } : {}),
        ...(publishedAt ? { date: publishedAt.slice(0, 10) } : {}),
      },
    ];
  });
}

function readTopicStep(
  context: ServiceContext,
  scope: Scope,
  search: KnowledgeTopicSearch,
  step: KnowledgeTopicStep,
): Promise<KnowledgeArticleCandidate[]> {
  if (step.provider === "feeds") {
    return findFeedArticles(context, scope, search);
  }

  if (step.provider === "news") {
    return findNewsResults(context, search.query, {
      days: step.days ?? search.days,
      country: search.country,
      language: search.language,
    });
  }

  return findWebResults(context, search.query);
}

export async function findTopicArticles(
  context: ServiceContext,
  scope: Scope,
  search: KnowledgeTopicSearch,
): Promise<KnowledgeArticleCandidate[]> {
  let found: KnowledgeArticleCandidate[] = [];
  let failure: unknown = null;

  for (const step of KNOWLEDGE_TOPIC_LINEUPS[search.kind]) {
    if (!shouldRunTopicStep(step, found.length, search.limit)) {
      continue;
    }

    try {
      found = dedupeArticleCandidates([
        ...found,
        ...(await readTopicStep(context, scope, search, step)),
      ]).slice(0, search.limit);
    } catch (error) {
      failure ??= error;
      logger.warn("A topic source could not be read", {
        provider: step.provider,
        error_message: getErrorMessage(error),
      });
    }
  }

  if (found.length === 0 && failure) {
    throw failure;
  }

  return found;
}

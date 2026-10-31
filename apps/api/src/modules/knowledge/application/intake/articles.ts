import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { KnowledgeOrigin } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS, resolveHttpUrl, truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { paginate } from "@ngriffin_uk/polychat-utility-server/arrays";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  commitKnowledgeDocument,
  knowledgeSourceId,
} from "~/modules/knowledge/application/intake/commit";
import { extendKnowledgeExpiry } from "~/modules/knowledge/domain/envelope";
import {
  dedupeArticleCandidates,
  knowledgeArticleKey,
  type KnowledgeArticleCandidate,
  type KnowledgeTarget,
} from "~/modules/knowledge/domain/item";
import { readSourceSummary } from "~/modules/sources/domain/summary";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { readPageContents } from "~/modules/tools/application/retrieval/page-contents";

const logger = getLogger({ prefix: "sources/knowledge-articles" });
const PAGE_READ_BATCH = 10;
const ARTICLE_FILE_CONCURRENCY = 4;
const MAX_ARTICLE_CHARACTERS = 400_000;

export interface GatheredArticle extends KnowledgeArticleCandidate {
  sourceId: string | null;
}

export interface GatherArticlesOptions {
  origin: KnowledgeOrigin;
  readLimit: number;
  metadata: (candidate: KnowledgeArticleCandidate) => Record<string, unknown>;
  keepDays?: number;
}

async function readArticlePages(
  context: ServiceContext,
  urls: string[],
): Promise<Map<string, string>> {
  const pages = new Map<string, string>();

  for (const batch of paginate(urls, PAGE_READ_BATCH)) {
    try {
      for (const [url, content] of await readPageContents(context, batch)) {
        pages.set(url, content);
      }
    } catch (error) {
      logger.warn("Some pages could not be read", { error_message: getErrorMessage(error) });
    }
  }

  return pages;
}

export async function gatherKnowledgeArticles(
  context: ServiceContext,
  target: KnowledgeTarget,
  candidates: readonly KnowledgeArticleCandidate[],
  options: GatherArticlesOptions,
): Promise<GatheredArticle[]> {
  const keyed = await Promise.all(
    dedupeArticleCandidates(candidates).flatMap((candidate) => {
      const key = knowledgeArticleKey(candidate.url);

      return key
        ? [knowledgeSourceId(target, key).then((sourceId) => ({ candidate, sourceId }))]
        : [];
    }),
  );
  const known = new Map(
    (
      await context.repositories
        .get(SourceRepository)
        .getSourcesByIds(keyed.map((entry) => entry.sourceId))
    )
      .filter((source) => source.project_id === target.projectId && source.status === "available")
      .map((source) => [source.id, source]),
  );
  const contentByUrl = await readArticlePages(
    context,
    keyed
      .filter((entry) => !known.has(entry.sourceId))
      .slice(0, options.readLimit)
      .map((entry) => entry.candidate.url),
  );
  const readAt = new Date().toISOString();
  const expiresAt = options.keepDays
    ? new Date(Date.now() + options.keepDays * DAY_MS).toISOString()
    : null;

  return mapWithConcurrency(
    keyed,
    ARTICLE_FILE_CONCURRENCY,
    async ({ candidate, sourceId }): Promise<GatheredArticle> => {
      const url = resolveHttpUrl(candidate.url);
      const stored = known.get(sourceId);
      const content = url ? contentByUrl.get(url) : undefined;

      if (!url || (!stored && !content)) {
        return { ...candidate, sourceId: null };
      }

      const summary = stored ? readSourceSummary(parseJsonRecord(stored.metadata)) : null;

      try {
        await commitKnowledgeDocument(context, target, {
          id: sourceId,
          origin: options.origin,
          kind: "url",
          title: stored?.title ?? candidate.title.slice(0, 200),
          provider: "web",
          externalUri: url,
          ...(expiresAt
            ? {
                expiresAt: extendKnowledgeExpiry(
                  stored ? parseJsonRecord(stored.metadata) : null,
                  expiresAt,
                  stored !== undefined,
                ),
              }
            : {}),
          content:
            content === undefined ? undefined : truncateForModel(content, MAX_ARTICLE_CHARACTERS),
          metadata: {
            ...options.metadata(candidate),
            ...(candidate.source ? { source: candidate.source } : {}),
            ...(content === undefined ? {} : { readAt }),
          },
        });
      } catch (error) {
        logger.warn("An article could not be filed", {
          url,
          error_message: getErrorMessage(error),
        });

        return { ...candidate, sourceId: null };
      }

      return { ...candidate, ...(summary ? { snippet: summary.summary } : {}), sourceId };
    },
  );
}

import {
  DISCOVER_ARTICLE_METADATA_KEY,
  STORY_RECLUSTER_LIMIT,
  type StoryIntakeArticle,
} from "@ngriffin_uk/polychat-schemas";
import {
  chunkArray,
  comparableHttpUrl,
  hasMarkdownMarkup,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import {
  ArticleFactRepository,
  type ArticleFactRecord,
} from "~/modules/stories/infrastructure/ArticleFactRepository";
import { DevStoryVectorStore } from "~/modules/stories/infrastructure/DevStoryVectorStore";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { BACKFILL_DEFAULT_TIME, readStandfirst, toIntakeArticle } from "./backfill";
import { ingestStoryArticles, type StoryIngestOutcome } from "./ingest";
import { mergeOpenStories } from "./merge";

const RECLUSTER_BATCH = 40;
const FALLBACK_TOPIC = "news";

export function assertDevelopmentRecluster(env: IEnv): void {
  if (env.ENV !== "development" || env.DISCOVER_ARTICLE_VECTORS) {
    throw new AssistantError("Not found", ErrorType.NOT_FOUND, 404);
  }
}

function toSnapshotArticle(fact: ArticleFactRecord): StoryIntakeArticle {
  return {
    url: fact.url,
    headline: fact.headline,
    standfirst: fact.standfirst,
    outlet: fact.outlet_name,
    topic: fact.topic_key ?? FALLBACK_TOPIC,
    publishedAt: fact.published_at,
    ...(fact.image_url ? { imageUrl: fact.image_url } : {}),
  };
}

function hasPageResidue(fact: ArticleFactRecord): boolean {
  return (
    hasMarkdownMarkup(fact.standfirst) ||
    fact.standfirst.toLowerCase().includes(fact.headline.toLowerCase())
  );
}

function needsRepair(fact: ArticleFactRecord): boolean {
  return hasPageResidue(fact) || fact.published_at.endsWith(BACKFILL_DEFAULT_TIME);
}

export async function snapshotStoryFacts(env: IEnv): Promise<StoryIntakeArticle[]> {
  assertDevelopmentRecluster(env);

  const facts = (await new ArticleFactRepository(env).listAllByPublished()).slice(
    0,
    STORY_RECLUSTER_LIMIT,
  );
  const repairs = facts.filter(needsRepair);
  const sources = await new SourceRepository(env).listPersonalPagesByExternalUri(
    DISCOVER_ARTICLE_METADATA_KEY,
    repairs.map((fact) => fact.url),
  );
  const rebuilt = new Map(
    sources.flatMap((source) => {
      const article = toIntakeArticle(source);
      const key = article ? comparableHttpUrl(article.url) : null;

      return article && key ? [[key, article] as const] : [];
    }),
  );

  return facts
    .map((fact) =>
      needsRepair(fact)
        ? (rebuilt.get(comparableHttpUrl(fact.url) ?? "") ?? {
            ...toSnapshotArticle(fact),
            standfirst: hasPageResidue(fact)
              ? readStandfirst(fact.standfirst, fact.headline)
              : fact.standfirst,
          })
        : toSnapshotArticle(fact),
    )
    .sort((left, right) => left.publishedAt.localeCompare(right.publishedAt));
}

export async function reclusterStories(
  env: IEnv,
  articles: readonly StoryIntakeArticle[],
): Promise<StoryIngestOutcome & { merged: number }> {
  assertDevelopmentRecluster(env);

  await new StoryRepository(env).clearGraph();
  await new DevStoryVectorStore(env, "articles").clear();
  await new DevStoryVectorStore(env, "stories").clear();

  const outcome: StoryIngestOutcome = { added: 0, attached: 0, opened: 0 };

  for (const batch of chunkArray([...articles], RECLUSTER_BATCH)) {
    const result = await ingestStoryArticles(env, batch);

    outcome.added += result.added;
    outcome.attached += result.attached;
    outcome.opened += result.opened;
  }

  return { ...outcome, merged: (await mergeOpenStories(env)).length };
}

import {
  DISCOVER_ARTICLE_METADATA_KEY,
  storyIntakeArticleSchema,
  type StoryIntakeArticle,
} from "@ngriffin_uk/polychat-schemas";
import { readUrlHost, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import { isDiscoverNewsTopic } from "~/modules/discover/domain/news-categories";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { ArticleFactRepository } from "~/modules/stories/infrastructure/ArticleFactRepository";
import type { IEnv } from "~/types";

import { queueStoryBackfill, queueStoryIntake } from "./intake";

const BACKFILL_PAGE_SIZE = 100;
const STANDFIRST_LENGTH = 280;
const discoverArticleMetadataSchema = z.object({
  topic: z.string().min(1),
  date: z.string().optional(),
});

function readPublishedAt(date: string | undefined, fallback: string): string {
  const parsed = date ? Date.parse(`${date.slice(0, 10)}T12:00:00.000Z`) : Number.NaN;

  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date(fallback).toISOString();
}

function toIntakeArticle(source: SourceRecord): StoryIntakeArticle | null {
  const metadata = parseJsonRecord(source.metadata);
  const article = discoverArticleMetadataSchema.safeParse(metadata[DISCOVER_ARTICLE_METADATA_KEY]);

  if (!article.success || !isDiscoverNewsTopic(article.data.topic) || !source.external_uri) {
    return null;
  }

  const outlet =
    typeof metadata.source === "string" && metadata.source.trim()
      ? metadata.source
      : readUrlHost(source.external_uri);
  const parsed = storyIntakeArticleSchema.safeParse({
    url: source.external_uri,
    headline: truncateSingleLine(source.title, 300),
    standfirst: truncateSingleLine(source.content ?? "", STANDFIRST_LENGTH),
    outlet: truncateSingleLine(outlet || "Unknown", 120),
    topic: truncateSingleLine(article.data.topic, 80),
    publishedAt: readPublishedAt(article.data.date, source.created_at),
  });

  return parsed.success ? parsed.data : null;
}

export async function backfillStoryPage(env: IEnv, after?: string): Promise<number> {
  const page = await new SourceRepository(env).listPersonalPagesWithMetadata(
    DISCOVER_ARTICLE_METADATA_KEY,
    { after, limit: BACKFILL_PAGE_SIZE },
  );
  const articles = page.flatMap((source) => toIntakeArticle(source) ?? []);

  if (articles.length > 0) {
    await queueStoryIntake(env, articles);
  }

  const last = page.at(-1);

  if (last && page.length === BACKFILL_PAGE_SIZE) {
    await queueStoryBackfill(env, last.id);
  }

  return articles.length;
}

export async function startStoryBackfillWhenEmpty(env: IEnv): Promise<void> {
  if (!env.DISCOVER_ARTICLE_VECTORS || (await new ArticleFactRepository(env).hasAny())) {
    return;
  }

  await queueStoryBackfill(env);
}

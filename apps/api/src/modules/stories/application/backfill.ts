import {
  DISCOVER_ARTICLE_METADATA_KEY,
  storyIntakeArticleSchema,
  type StoryIntakeArticle,
} from "@ngriffin_uk/polychat-schemas";
import {
  isBoilerplate,
  leadParagraphs,
  markdownToPlainText,
  readUrlHost,
  trimToLastSentence,
  wordOverlap,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import { isDiscoverNewsTopic } from "~/modules/discover/domain/news-categories";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { ArticleFactRepository } from "~/modules/stories/infrastructure/ArticleFactRepository";
import { StoryVectorIndex } from "~/modules/stories/infrastructure/StoryVectorIndex";
import type { IEnv } from "~/types";

import { queueStoryBackfill, queueStoryIntake } from "./intake";

const BACKFILL_PAGE_SIZE = 100;
const STANDFIRST_LENGTH = 280;
const MIN_STANDFIRST_WORDS = 6;
const HEADLINE_REPEAT_OVERLAP = 0.8;
const discoverArticleMetadataSchema = z.object({
  topic: z.string().min(1),
  date: z.string().optional(),
});

export const BACKFILL_DEFAULT_TIME = "T12:00:00.000Z";

function readPublishedAt(date: string | undefined, readAt: unknown, fallback: string): string {
  const day = date?.slice(0, 10);

  if (
    day &&
    typeof readAt === "string" &&
    readAt.slice(0, 10) === day &&
    Number.isFinite(Date.parse(readAt))
  ) {
    return new Date(readAt).toISOString();
  }

  const parsed = day ? Date.parse(`${day}${BACKFILL_DEFAULT_TIME}`) : Number.NaN;

  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date(fallback).toISOString();
}

function afterLastHeading(text: string): string {
  const at = text.lastIndexOf("# ");

  return at === -1 ? text : text.slice(at + 2);
}

export function readStandfirst(content: string, headline: string): string {
  const plain = markdownToPlainText(content);
  const at = plain.toLowerCase().lastIndexOf(headline.toLowerCase());
  const body = afterLastHeading(at === -1 ? plain : plain.slice(at + headline.length)).trim();
  const lead = trimToLastSentence(leadParagraphs(body, STANDFIRST_LENGTH * 2) || body);
  const repeatsHeadline = wordOverlap(lead, headline) >= HEADLINE_REPEAT_OVERLAP;

  return lead.split(/\s+/u).length >= MIN_STANDFIRST_WORDS &&
    !repeatsHeadline &&
    !isBoilerplate(lead)
    ? truncateSingleLine(lead, STANDFIRST_LENGTH)
    : "";
}

export function toIntakeArticle(source: SourceRecord): StoryIntakeArticle | null {
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
    standfirst: readStandfirst(source.content ?? "", source.title),
    outlet: truncateSingleLine(outlet || "Unknown", 120),
    topic: truncateSingleLine(article.data.topic, 80),
    publishedAt: readPublishedAt(article.data.date, metadata.readAt, source.created_at),
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
  if (!StoryVectorIndex.from(env) || (await new ArticleFactRepository(env).hasAny())) {
    return;
  }

  await queueStoryBackfill(env);
}

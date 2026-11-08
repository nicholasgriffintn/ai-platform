import type { StoryIntakeArticle } from "@ngriffin_uk/polychat-schemas";
import {
  blendVectors,
  chunkArray,
  comparableHttpUrl,
  cosineSimilarity,
  normaliseVector,
  sha256Hex,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "~/modules/discover/domain/edition";
import {
  decideStory,
  readArticleSignals,
  STORY_MATCH_LIMIT,
  storyWindow,
  type ArticleSignals,
  type StoryMatch,
} from "~/modules/stories/domain/clustering";
import { outletId } from "~/modules/stories/domain/outlets";
import { needsStoryVersion } from "~/modules/stories/domain/refresh";
import { ArticleFactRepository } from "~/modules/stories/infrastructure/ArticleFactRepository";
import {
  StoryRepository,
  type StoryRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import { StoryVectorIndex } from "~/modules/stories/infrastructure/StoryVectorIndex";
import type { IEnv } from "~/types";

import { queueStoryRefresh } from "./intake";
import { storyRefreshState } from "./read-models";

const EMBED_BATCH = 20;
const STORY_SLUG_LENGTH = 80;

export interface StoryIngestOutcome {
  added: number;
  attached: number;
  opened: number;
}

interface KeyedArticle extends StoryIntakeArticle {
  id: string;
}

interface BatchVector {
  storyId: string;
  publishedAt: string;
  vector: number[];
  signals: ArticleSignals;
}

function embeddingText(article: Pick<StoryIntakeArticle, "headline" | "standfirst">): string {
  return article.standfirst ? `${article.headline}. ${article.standfirst}` : article.headline;
}

export async function articleFactId(url: string): Promise<string | null> {
  const comparable = comparableHttpUrl(url);

  return comparable ? (await sha256Hex(comparable)).slice(0, 32) : null;
}

async function keyArticles(articles: readonly StoryIntakeArticle[]): Promise<KeyedArticle[]> {
  const keyed = new Map<string, KeyedArticle>();

  for (const article of articles) {
    const id = await articleFactId(article.url);

    if (id && !keyed.has(id)) {
      keyed.set(id, { ...article, id });
    }
  }

  return [...keyed.values()];
}

async function embedArticles(index: StoryVectorIndex, articles: readonly KeyedArticle[]) {
  const vectors = new Map<string, number[]>();

  for (const batch of chunkArray([...articles], EMBED_BATCH)) {
    const embeddings = await index.embed(batch.map(embeddingText));

    batch.forEach((article, position) => {
      const vector = embeddings[position];

      if (vector) {
        vectors.set(article.id, vector);
      }
    });
  }

  return vectors;
}

async function findMatches(
  index: StoryVectorIndex,
  facts: ArticleFactRepository,
  vector: readonly number[],
  publishedAt: string,
  batch: readonly BatchVector[],
): Promise<StoryMatch[]> {
  const window = storyWindow(publishedAt);
  const remote = await index.queryArticles(vector, window, STORY_MATCH_LIMIT);
  const known = new Map(
    (await facts.listByIds(remote.map((match) => match.id))).map((fact) => [fact.id, fact]),
  );

  return [
    ...remote.flatMap((match) => {
      const fact = known.get(match.id);

      return fact
        ? [
            {
              storyId: fact.story_id,
              score: match.score,
              signals: readArticleSignals(fact.headline, fact.standfirst),
            },
          ]
        : [];
    }),
    ...batch
      .filter((entry) => entry.publishedAt >= window.since && entry.publishedAt <= window.until)
      .map((entry) => ({
        storyId: entry.storyId,
        score: cosineSimilarity(vector, entry.vector),
        signals: entry.signals,
      })),
  ];
}

async function chooseStory(
  stories: StoryRepository,
  article: KeyedArticle,
  signals: ArticleSignals,
  matches: readonly StoryMatch[],
  publishedAt: string,
): Promise<{ storyId: string; opened: boolean }> {
  const decision = decideStory(signals, matches);
  const existing = decision.kind === "attach" ? await stories.get(decision.storyId) : null;

  if (existing?.status === "open") {
    return { storyId: existing.id, opened: false };
  }

  const storyId = `story_${article.id.slice(0, 24)}`;

  await stories.open({
    id: storyId,
    slug: slugify(article.headline, STORY_SLUG_LENGTH),
    title: article.headline,
    openedAt: publishedAt,
    topicKey: discoverTopicKey(article.topic),
  });

  return { storyId, opened: true };
}

async function recentre(
  index: StoryVectorIndex,
  story: StoryRecord,
  vector: readonly number[],
  opened: boolean,
): Promise<void> {
  const previous = opened ? null : await index.readStoryVector(story.id);
  const centroid = previous
    ? blendVectors(previous, Math.max(1, story.article_count - 1), vector)
    : normaliseVector(vector);

  await index.upsertStory(story.id, centroid, story.last_article_at);
}

export async function ingestStoryArticles(
  env: IEnv,
  articles: readonly StoryIntakeArticle[],
  now = new Date(),
): Promise<StoryIngestOutcome> {
  const outcome: StoryIngestOutcome = { added: 0, attached: 0, opened: 0 };
  const index = StoryVectorIndex.from(env);

  if (!index) {
    return outcome;
  }

  const facts = new ArticleFactRepository(env);
  const stories = new StoryRepository(env);
  const keyed = await keyArticles(articles);
  const known = new Set(
    (await facts.listByIds(keyed.map((article) => article.id))).map((fact) => fact.id),
  );
  const fresh = keyed.filter((article) => !known.has(article.id));
  const vectors = await embedArticles(index, fresh);
  const batch: BatchVector[] = [];
  const refreshed = new Set<string>();

  for (const article of fresh) {
    const vector = vectors.get(article.id);

    if (!vector) {
      continue;
    }

    const publishedAt = new Date(
      Math.min(Date.parse(article.publishedAt), now.getTime()),
    ).toISOString();
    const signals = readArticleSignals(article.headline, article.standfirst);
    const matches = await findMatches(index, facts, vector, publishedAt, batch);
    const { storyId, opened } = await chooseStory(stories, article, signals, matches, publishedAt);
    const outlet = outletId(article.outlet);
    const inserted = await facts.insert({
      id: article.id,
      url: article.url,
      outlet_id: outlet,
      outlet_name: article.outlet,
      headline: article.headline,
      standfirst: article.standfirst,
      published_at: publishedAt,
      first_seen_at: now.toISOString(),
      language: null,
      topic_key: discoverTopicKey(article.topic),
      story_id: storyId,
      image_url: article.imageUrl ?? null,
    });
    const story = inserted ? await stories.recount(storyId) : null;

    if (!story) {
      continue;
    }

    await index.upsertArticle(article.id, vector, {
      storyId,
      outletId: outlet,
      topicKey: story.primary_topic_key,
      publishedAt,
    });
    await recentre(index, story, vector, opened);
    batch.push({ storyId, publishedAt, vector, signals });
    outcome.added += 1;
    outcome[opened ? "opened" : "attached"] += 1;

    if (!refreshed.has(storyId) && needsStoryVersion(storyRefreshState(story), now)) {
      refreshed.add(storyId);
      await queueStoryRefresh(env, storyId, now);
    }
  }

  return outcome;
}

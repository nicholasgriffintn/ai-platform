import {
  storyArticleSchema,
  type StoryArticle,
  type StoryPage,
  type StorySummary,
  type StoryVersion,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  parseJsonArrayColumn,
  parseJsonStringArray,
} from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { StoryRefreshState } from "~/modules/stories/domain/refresh";
import {
  ArticleFactRepository,
  type ArticleFactRecord,
} from "~/modules/stories/infrastructure/ArticleFactRepository";
import {
  StoryRepository,
  type StoryRecord,
  type StoryVersionRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

const STORY_PAGE_ARTICLE_LIMIT = 60;
const outletAngleSchema = z.object({ source: z.string(), angle: z.string() });

export function storyRefreshState(story: StoryRecord): StoryRefreshState {
  return {
    status: story.status,
    articleCount: story.article_count,
    outletCount: story.outlet_count,
    versionedArticleCount: story.versioned_article_count,
    versionedOutletCount: story.versioned_outlet_count,
    versionedAt: story.versioned_at,
  };
}

export function presentStorySummary(story: StoryRecord): StorySummary {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    status: story.status,
    openedAt: story.opened_at,
    lastArticleAt: story.last_article_at,
    articleCount: story.article_count,
    outletCount: story.outlet_count,
    topicKey: story.primary_topic_key,
  };
}

export function presentStoryVersion(version: StoryVersionRecord): StoryVersion {
  return {
    version: version.version,
    writtenAt: version.written_at,
    overview: parseJsonStringArray(version.overview) ?? [],
    agreed: parseJsonStringArray(version.agreed) ?? [],
    disputed: parseJsonStringArray(version.disputed) ?? [],
    gaps: parseJsonStringArray(version.gaps) ?? [],
    outlets: parseJsonArrayColumn(version.outlet_angles, outletAngleSchema) ?? [],
  };
}

export function presentStoryArticle(fact: ArticleFactRecord): StoryArticle | null {
  const parsed = storyArticleSchema.safeParse({
    id: fact.id,
    url: fact.url,
    outlet: fact.outlet_name,
    headline: fact.headline,
    standfirst: fact.standfirst,
    publishedAt: fact.published_at,
    imageUrl: fact.image_url,
  });

  return parsed.success ? parsed.data : null;
}

export async function requireStory(env: IEnv, storyId: string): Promise<StoryRecord> {
  const story = await new StoryRepository(env).get(storyId);

  if (!story) {
    throw new AssistantError("Story not found", ErrorType.NOT_FOUND, 404);
  }

  return story;
}

export async function readStoryPage(env: IEnv, storyId: string): Promise<StoryPage> {
  const story = await requireStory(env, storyId);
  const [version, facts] = await Promise.all([
    new StoryRepository(env).latestVersion(storyId),
    new ArticleFactRepository(env).listForStory(storyId, STORY_PAGE_ARTICLE_LIMIT),
  ]);

  return {
    story: presentStorySummary(story),
    version: version ? presentStoryVersion(version) : null,
    articles: facts.flatMap((fact) => presentStoryArticle(fact) ?? []),
  };
}

export async function listStoryIdsByUrl(
  env: IEnv,
  urls: readonly string[],
): Promise<Map<string, string>> {
  const facts = await new ArticleFactRepository(env).listByUrls(urls);

  return new Map(facts.map((fact) => [fact.url, fact.story_id]));
}

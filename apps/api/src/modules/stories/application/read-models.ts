import {
  storyArticleSchema,
  storyQuoteSchema,
  type EntityPage,
  type RelatedStory,
  type StoryArticle,
  type StoryEntity,
  type StoryPage,
  type StoryQuote,
  type StorySummary,
  type StoryVersion,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";
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
  EntityRepository,
  type EntityRecord,
} from "~/modules/stories/infrastructure/EntityRepository";
import {
  QuoteRepository,
  type QuoteRecord,
} from "~/modules/stories/infrastructure/QuoteRepository";
import { StoryEdgeRepository } from "~/modules/stories/infrastructure/StoryEdgeRepository";
import {
  StoryRepository,
  type StoryRecord,
  type StoryVersionRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import { StoryVectorIndex } from "~/modules/stories/infrastructure/StoryVectorIndex";
import type { IEnv } from "~/types";

const STORY_PAGE_ARTICLE_LIMIT = 60;
const STORY_PAGE_QUOTE_LIMIT = 12;
const STORY_PAGE_EDGE_LIMIT = 8;
const STORY_BEHIND_LIMIT = 2;
const ENTITY_PAGE_STORY_LIMIT = 40;
const ENTITY_PAGE_QUOTE_LIMIT = 20;
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

export function presentStoryQuote(quote: QuoteRecord): StoryQuote | null {
  const parsed = storyQuoteSchema.safeParse({
    id: quote.id,
    storyId: quote.story_id,
    speaker: quote.speaker,
    speakerEntityId: quote.speaker_entity_id,
    context: quote.context,
    text: quote.text,
    outlet: quote.outlet_name,
    url: quote.url,
    verifiedAt: quote.verified_at,
  });

  return parsed.success ? parsed.data : null;
}

export function presentStoryEntity(entity: EntityRecord): StoryEntity {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    aliases: parseJsonStringArray(entity.aliases) ?? [],
    firstSeenAt: entity.first_seen_at,
    lastSeenAt: entity.last_seen_at,
    mentionCount: entity.mention_count,
  };
}

async function listStoriesBefore(env: IEnv, storyId: string): Promise<RelatedStory[]> {
  const edges = await new StoryEdgeRepository(env).listFrom(storyId, STORY_PAGE_EDGE_LIMIT);
  const stories = new Map(
    (await new StoryRepository(env).listByIds(edges.map((edge) => edge.to_story_id))).map(
      (story) => [story.id, story],
    ),
  );

  return edges
    .flatMap((edge) => {
      const story = stories.get(edge.to_story_id);

      return story ? [{ ...presentStorySummary(story), kind: edge.kind, score: edge.score }] : [];
    })
    .sort((left, right) => right.lastArticleAt.localeCompare(left.lastArticleAt));
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
  const [version, facts, quotes, entities, before] = await Promise.all([
    new StoryRepository(env).latestVersion(storyId),
    new ArticleFactRepository(env).listForStory(storyId, STORY_PAGE_ARTICLE_LIMIT),
    new QuoteRepository(env).listForStory(storyId, STORY_PAGE_QUOTE_LIMIT),
    new EntityRepository(env).listForStory(storyId),
    listStoriesBefore(env, storyId),
  ]);

  return {
    story: presentStorySummary(story),
    version: version ? presentStoryVersion(version) : null,
    articles: facts.flatMap((fact) => presentStoryArticle(fact) ?? []),
    quotes: quotes.flatMap((quote) => presentStoryQuote(quote) ?? []),
    entities,
    before,
  };
}

export async function readEntityPage(env: IEnv, entityId: string): Promise<EntityPage> {
  const entities = new EntityRepository(env);
  const entity = await entities.get(entityId);

  if (!entity) {
    throw new AssistantError("Entity not found", ErrorType.NOT_FOUND, 404);
  }

  const [mentions, quotes] = await Promise.all([
    entities.listStories(entityId, ENTITY_PAGE_STORY_LIMIT),
    new QuoteRepository(env).listForSpeaker(entityId, ENTITY_PAGE_QUOTE_LIMIT),
  ]);
  const stories = new Map(
    (await new StoryRepository(env).listByIds(mentions.map((mention) => mention.story_id))).map(
      (story) => [story.id, story],
    ),
  );

  return {
    entity: presentStoryEntity(entity),
    stories: mentions
      .flatMap((mention) => {
        const story = stories.get(mention.story_id);

        return story ? [{ ...presentStorySummary(story), role: mention.role }] : [];
      })
      .sort((left, right) => right.lastArticleAt.localeCompare(left.lastArticleAt)),
    quotes: quotes.flatMap((quote) => presentStoryQuote(quote) ?? []),
  };
}

export async function findRelatedStories(
  env: IEnv,
  input: { storyId?: string; query?: string; limit: number },
): Promise<RelatedStory[]> {
  if (input.storyId) {
    await requireStory(env, input.storyId);
    const linked = await listStoriesBefore(env, input.storyId);

    if (linked.length > 0 || !input.query) {
      return linked.slice(0, input.limit);
    }
  }

  const index = StoryVectorIndex.require(env);
  const [vector] = input.query ? await index.embed([input.query]) : [];

  if (!vector) {
    return [];
  }

  const matches = await index.queryStories(vector, input.limit);
  const stories = new Map(
    (await new StoryRepository(env).listByIds(matches.map((match) => match.id))).map((story) => [
      story.id,
      story,
    ]),
  );

  return matches.flatMap((match) => {
    const story = stories.get(match.id);

    return story ? [{ ...presentStorySummary(story), kind: null, score: match.score }] : [];
  });
}

export async function listStoriesByUrl(
  env: IEnv,
  urls: readonly string[],
): Promise<Map<string, StorySummary>> {
  const facts = await new ArticleFactRepository(env).listByUrls([...new Set(urls)]);
  const stories = new Map(
    (
      await new StoryRepository(env).listByIds([...new Set(facts.map((fact) => fact.story_id))])
    ).map((story) => [story.id, presentStorySummary(story)]),
  );

  return new Map(
    facts.flatMap((fact) => {
      const story = stories.get(fact.story_id);
      const url = comparableHttpUrl(fact.url);

      return story && url ? [[url, story] as const] : [];
    }),
  );
}

export async function listStoriesBehind(
  env: IEnv,
  storyIds: readonly string[],
): Promise<Array<{ story: StorySummary; before: RelatedStory }>> {
  const unique = [...new Set(storyIds)];
  const [current, edges] = await Promise.all([
    new StoryRepository(env).listByIds(unique),
    Promise.all(
      unique.map((storyId) => new StoryEdgeRepository(env).listFrom(storyId, STORY_BEHIND_LIMIT)),
    ),
  ]);
  const older = new Map(
    (await new StoryRepository(env).listByIds(edges.flat().map((edge) => edge.to_story_id))).map(
      (story) => [story.id, story],
    ),
  );
  const stories = new Map(current.map((story) => [story.id, story]));

  return edges.flat().flatMap((edge) => {
    const story = stories.get(edge.from_story_id);
    const before = older.get(edge.to_story_id);

    return story && before && (edge.kind === "continues" || edge.kind === "background")
      ? [
          {
            story: presentStorySummary(story),
            before: { ...presentStorySummary(before), kind: edge.kind, score: edge.score },
          },
        ]
      : [];
  });
}

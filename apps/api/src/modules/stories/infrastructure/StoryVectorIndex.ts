import { isoToEpochSeconds } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

export const STORY_EMBEDDING_MODEL = "@cf/baai/bge-m3";

export interface ArticleVectorMatch {
  id: string;
  score: number;
  storyId: string | null;
}

export interface StoryVectorMatch {
  id: string;
  score: number;
}

export interface ArticleVectorMetadata {
  storyId: string;
  outletId: string;
  topicKey: string | null;
  publishedAt: string;
}

export class StoryVectorIndex {
  private constructor(
    private readonly env: IEnv,
    private readonly articles: Vectorize,
    private readonly stories: Vectorize,
  ) {}

  static from(env: IEnv): StoryVectorIndex | null {
    return env.DISCOVER_ARTICLE_VECTORS && env.DISCOVER_STORY_VECTORS
      ? new StoryVectorIndex(env, env.DISCOVER_ARTICLE_VECTORS, env.DISCOVER_STORY_VECTORS)
      : null;
  }

  static require(env: IEnv): StoryVectorIndex {
    const index = StoryVectorIndex.from(env);

    if (!index) {
      throw new AssistantError(
        "The story indexes are not configured",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    return index;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const result = await this.env.AI.run(STORY_EMBEDDING_MODEL, { text: [...texts] });

    return "data" in result && result.data ? result.data : [];
  }

  async queryArticles(
    vector: readonly number[],
    window: { since: string; until: string },
    topK: number,
  ): Promise<ArticleVectorMatch[]> {
    const since = isoToEpochSeconds(window.since);
    const until = isoToEpochSeconds(window.until);
    const result = await this.articles.query([...vector], {
      topK,
      returnMetadata: "all",
      filter: { publishedAt: { $gte: since, $lte: until } },
    });

    return result.matches.flatMap((match) => {
      const publishedAt = match.metadata?.publishedAt;
      const storyId = match.metadata?.storyId;

      return typeof publishedAt === "number" && publishedAt >= since && publishedAt <= until
        ? [
            {
              id: match.id,
              score: match.score,
              storyId: typeof storyId === "string" ? storyId : null,
            },
          ]
        : [];
    });
  }

  async upsertArticle(id: string, vector: readonly number[], metadata: ArticleVectorMetadata) {
    await this.articles.upsert([
      {
        id,
        values: [...vector],
        metadata: {
          storyId: metadata.storyId,
          outletId: metadata.outletId,
          publishedAt: isoToEpochSeconds(metadata.publishedAt),
          ...(metadata.topicKey ? { topicKey: metadata.topicKey } : {}),
        },
      },
    ]);
  }

  async readStoryVector(storyId: string): Promise<number[] | null> {
    const [vector] = await this.stories.getByIds([storyId]);

    return vector ? Array.from(vector.values) : null;
  }

  async upsertStory(storyId: string, vector: readonly number[], lastArticleAt: string) {
    await this.stories.upsert([
      {
        id: storyId,
        values: [...vector],
        metadata: { lastArticleAt: isoToEpochSeconds(lastArticleAt) },
      },
    ]);
  }

  async queryStories(vector: readonly number[], topK: number): Promise<StoryVectorMatch[]> {
    const result = await this.stories.query([...vector], { topK });

    return result.matches.map((match) => ({ id: match.id, score: match.score }));
  }
}

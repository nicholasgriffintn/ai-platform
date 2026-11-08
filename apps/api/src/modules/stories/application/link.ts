import { parseJsonStringArray } from "@ngriffin_uk/polychat-utility-server/json";

import {
  decideStoryEdge,
  STORY_EDGE_QUERY_LIMIT,
  type EdgeStory,
} from "~/modules/stories/domain/edges";
import { StoryEdgeRepository } from "~/modules/stories/infrastructure/StoryEdgeRepository";
import {
  StoryRepository,
  type StoryRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import { StoryVectorIndex } from "~/modules/stories/infrastructure/StoryVectorIndex";
import type { IEnv } from "~/types";

function toEdgeStory(story: StoryRecord, leadEntityIds?: readonly string[]): EdgeStory {
  return {
    id: story.id,
    openedAt: story.opened_at,
    lastArticleAt: story.last_article_at,
    leadEntityIds: leadEntityIds ?? parseJsonStringArray(story.lead_entity_ids) ?? [],
  };
}

export async function linkStory(
  env: IEnv,
  story: StoryRecord,
  leadEntityIds: readonly string[],
  vector?: readonly number[],
): Promise<number> {
  const index = StoryVectorIndex.from(env);
  const centroid = vector ?? (index ? await index.readStoryVector(story.id) : null);

  if (!index || !centroid || leadEntityIds.length === 0) {
    return 0;
  }

  const matches = await index.queryStories(centroid, STORY_EDGE_QUERY_LIMIT);
  const candidates = new Map(
    (await new StoryRepository(env).listByIds(matches.map((match) => match.id))).map(
      (candidate) => [candidate.id, candidate],
    ),
  );
  const self = toEdgeStory(story, leadEntityIds);
  const createdAt = new Date().toISOString();
  const edges = matches.flatMap((match) => {
    const candidate = candidates.get(match.id);
    const edge = candidate ? decideStoryEdge(self, toEdgeStory(candidate), match.score) : null;

    return edge ? [{ ...edge, createdBy: "vector" as const, createdAt }] : [];
  });

  await new StoryEdgeRepository(env).upsertMany(edges);

  return edges.length;
}

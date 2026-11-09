import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { blendVectors } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonStringArray } from "@ngriffin_uk/polychat-utility-server/json";

import {
  decideStoryMerge,
  STORY_EDGE_QUERY_LIMIT,
  type MergeCandidate,
} from "~/modules/stories/domain/edges";
import { needsStoryVersion } from "~/modules/stories/domain/refresh";
import {
  StoryRepository,
  type StoryRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import { StoryVectorIndex } from "~/modules/stories/infrastructure/StoryVectorIndex";
import type { IEnv } from "~/types";

import { queueStoryRefresh } from "./intake";
import { storyRefreshState } from "./read-models";

const logger = getLogger({ prefix: "stories/merge" });
const MERGE_SWEEP_LIMIT = 200;

export interface StoryMerge {
  fromStoryId: string;
  intoStoryId: string;
  score: number;
}

function toCandidate(story: StoryRecord): MergeCandidate {
  return {
    id: story.id,
    status: story.status,
    openedAt: story.opened_at,
    lastArticleAt: story.last_article_at,
    articleCount: story.article_count,
    leadEntityIds: parseJsonStringArray(story.lead_entity_ids) ?? [],
  };
}

async function mergePair(
  env: IEnv,
  index: StoryVectorIndex,
  from: StoryRecord,
  into: StoryRecord,
  now: Date,
): Promise<void> {
  const [fromVector, intoVector] = await Promise.all([
    index.readStoryVector(from.id),
    index.readStoryVector(into.id),
  ]);
  const leads = [
    ...new Set([
      ...(parseJsonStringArray(into.lead_entity_ids) ?? []),
      ...(parseJsonStringArray(from.lead_entity_ids) ?? []),
    ]),
  ];
  const merged = await new StoryRepository(env).mergeInto(from.id, into.id, leads);

  if (fromVector && intoVector && merged) {
    await index.upsertStory(
      into.id,
      blendVectors(intoVector, into.article_count / Math.max(1, from.article_count), fromVector),
      merged.last_article_at,
    );
  }

  await index.removeStory(from.id);

  if (merged && needsStoryVersion(storyRefreshState(merged), now)) {
    await queueStoryRefresh(env, merged.id, now);
  }
}

export async function mergeRelatedStories(
  env: IEnv,
  storyId: string,
  now = new Date(),
): Promise<StoryMerge[]> {
  const index = StoryVectorIndex.from(env);
  const stories = new StoryRepository(env);
  const story = await stories.get(storyId);
  const vector = index && story ? await index.readStoryVector(story.id) : null;

  if (!index || !story || !vector) {
    return [];
  }

  const matches = await index.queryStories(vector, STORY_EDGE_QUERY_LIMIT);
  const candidates = new Map(
    (await stories.listByIds(matches.map((match) => match.id))).map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
  const merges: StoryMerge[] = [];
  let current: StoryRecord | null = story;

  for (const match of matches) {
    const candidate = candidates.get(match.id);

    if (!current || !candidate) {
      continue;
    }

    const decision = decideStoryMerge(toCandidate(current), toCandidate(candidate), match.score);

    if (!decision) {
      continue;
    }

    const [from, into] =
      decision.fromStoryId === current.id ? [current, candidate] : [candidate, current];

    await mergePair(env, index, from, into, now);
    merges.push({ ...decision, score: match.score });
    logger.info("Merged stories", { ...decision, score: match.score });
    current = into.id === current.id ? await stories.get(into.id) : null;
  }

  return merges;
}

export async function mergeOpenStories(env: IEnv, now = new Date()): Promise<StoryMerge[]> {
  const stories = new StoryRepository(env);
  const merged = new Set<string>();
  const merges: StoryMerge[] = [];

  for (const story of await stories.listOpenWithLeads(MERGE_SWEEP_LIMIT)) {
    if (merged.has(story.id)) {
      continue;
    }

    for (const merge of await mergeRelatedStories(env, story.id, now)) {
      merged.add(merge.fromStoryId);
      merges.push(merge);
    }
  }

  return merges;
}

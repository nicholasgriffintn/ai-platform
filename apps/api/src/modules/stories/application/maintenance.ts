import { quietSince } from "~/modules/stories/domain/edges";
import { needsStoryVersion } from "~/modules/stories/domain/refresh";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { startStoryBackfillWhenEmpty } from "./backfill";
import { cleanStoryEntities } from "./entity-cleanup";
import { queueStoryRefresh } from "./intake";
import { mergeOpenStories } from "./merge";
import { storyRefreshState } from "./read-models";

const AWAITING_VERSION_LIMIT = 50;

export async function runStoriesMaintenance(env: IEnv, now = new Date()): Promise<void> {
  const stories = new StoryRepository(env);

  await stories.closeQuiet(quietSince(now), now.toISOString());
  await cleanStoryEntities(env);
  await mergeOpenStories(env, now);

  for (const story of await stories.listAwaitingVersion(AWAITING_VERSION_LIMIT)) {
    if (needsStoryVersion(storyRefreshState(story), now)) {
      await queueStoryRefresh(env, story.id, now);
    }
  }

  await startStoryBackfillWhenEmpty(env);
}

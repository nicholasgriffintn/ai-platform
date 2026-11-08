import { quietSince } from "~/modules/stories/domain/edges";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { startStoryBackfillWhenEmpty } from "./backfill";

export async function runStoriesMaintenance(env: IEnv, now = new Date()): Promise<void> {
  await new StoryRepository(env).closeQuiet(quietSince(now), now.toISOString());
  await startStoryBackfillWhenEmpty(env);
}

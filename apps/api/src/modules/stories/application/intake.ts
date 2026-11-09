import {
  STORIES_JOB_TASK_TYPE,
  STORY_INTAKE_LIMIT,
  type StoriesJobTaskData,
  type StoryIntakeArticle,
} from "@ngriffin_uk/polychat-schemas";
import { chunkArray, comparableHttpUrl, sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { storyRefreshSlot } from "~/modules/stories/domain/refresh";
import type { IEnv } from "~/types";

async function enqueueStoriesJob(
  env: IEnv,
  id: string,
  job: StoriesJobTaskData,
  scheduledAt?: Date,
): Promise<void> {
  await new TaskService(env, new TaskRepository(env)).enqueueTask({
    id,
    task_type: STORIES_JOB_TASK_TYPE,
    task_data: job,
    priority: 7,
    ...(scheduledAt ? { schedule_type: "scheduled", scheduled_at: scheduledAt.toISOString() } : {}),
  });
}

export async function queueStoryIntake(
  env: IEnv,
  articles: readonly StoryIntakeArticle[],
): Promise<number> {
  let queued = 0;

  for (const batch of chunkArray([...articles], STORY_INTAKE_LIMIT)) {
    const key = batch
      .map((article) => comparableHttpUrl(article.url) ?? article.url)
      .sort()
      .join("\n");

    await enqueueStoriesJob(env, `stories_ingest_${(await sha256Hex(key)).slice(0, 32)}`, {
      job: "ingest",
      articles: batch,
    });
    queued += batch.length;
  }

  return queued;
}

export async function queueStoryRefresh(env: IEnv, storyId: string, now: Date): Promise<void> {
  const slot = storyRefreshSlot(now);

  await enqueueStoriesJob(
    env,
    `stories_refresh_${storyId}_${slot.getTime()}`,
    { job: "refresh", storyId },
    slot,
  );
}

export async function queueStoryBackfill(env: IEnv, after?: string): Promise<void> {
  await enqueueStoriesJob(env, `stories_backfill_${after ?? "start"}`, {
    job: "backfill",
    ...(after ? { after } : {}),
  });
}

export async function queueStoryRecluster(
  env: IEnv,
  articles: StoryIntakeArticle[],
  now: Date,
): Promise<void> {
  await enqueueStoriesJob(env, `stories_recluster_${now.getTime()}`, {
    job: "recluster",
    articles,
  });
}

import { storiesJobTaskDataSchema, type StoriesJobTaskData } from "@ngriffin_uk/polychat-schemas";

import type { TaskResult } from "~/modules/queue/application/types";
import { defineTask } from "~/modules/queue/application/workflows";
import type { IEnv } from "~/types";

import { backfillStoryPage } from "../backfill";
import { ingestStoryArticles } from "../ingest";
import { refreshStory } from "../refresh";

async function runStoriesJob(env: IEnv, job: StoriesJobTaskData): Promise<TaskResult> {
  if (job.job === "ingest") {
    const outcome = await ingestStoryArticles(env, job.articles);

    return { status: "success", message: "Story facts ingested", data: { ...outcome } };
  }

  if (job.job === "refresh") {
    const outcome = await refreshStory(env, job.storyId);

    return {
      status: outcome === "written" ? "success" : "skipped",
      message: `Story refresh ${outcome}`,
    };
  }

  const queued = await backfillStoryPage(env, job.after);

  return { status: "success", message: "Story backfill page queued", data: { queued } };
}

export const storiesJob = defineTask<StoriesJobTaskData>({
  payload: storiesJobTaskDataSchema,
  handle: async (job, { env }) => runStoriesJob(env, job),
});

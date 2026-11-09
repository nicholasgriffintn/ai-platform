import { storiesJobTaskDataSchema, type StoriesJobTaskData } from "@ngriffin_uk/polychat-schemas";

import type { TaskResult } from "~/modules/queue/application/types";
import { defineTask } from "~/modules/queue/application/workflows";
import type { IEnv } from "~/types";

import { backfillStoryPage } from "../backfill";
import { ingestStoryArticles } from "../ingest";
import { reclusterStories } from "../recluster";
import { refreshStory } from "../refresh";

async function runStoriesJob(env: IEnv, job: StoriesJobTaskData): Promise<TaskResult> {
  if (job.job === "ingest") {
    const outcome = await ingestStoryArticles(env, job.articles);

    return { status: "success", message: "Story facts ingested", data: { ...outcome } };
  }

  if (job.job === "refresh") {
    const outcome = await refreshStory(env, job.storyId);

    return outcome.status === "written"
      ? { status: "success", message: "Story refresh written", data: { ...outcome.graph } }
      : { status: "skipped", message: `Story refresh ${outcome.status}` };
  }

  if (job.job === "recluster") {
    const outcome = await reclusterStories(env, job.articles);

    return { status: "success", message: "Stories reclustered", data: { ...outcome } };
  }

  const queued = await backfillStoryPage(env, job.after);

  return { status: "success", message: "Story backfill page queued", data: { queued } };
}

export const storiesJob = defineTask<StoriesJobTaskData>({
  payload: storiesJobTaskDataSchema,
  handle: async (job, { env }) => runStoriesJob(env, job),
});

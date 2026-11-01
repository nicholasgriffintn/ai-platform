import type { TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import {
  discoverEpisodeResponseSchema,
  discoverJobTaskDataSchema,
  type DiscoverEditionFollowUp,
  type DiscoverJobTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { settleAll } from "@ngriffin_uk/polychat-utility-server/async";
import { z } from "zod/v4";

import {
  withExecutionRunContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import type { TaskResult } from "~/modules/queue/application/types";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask } from "~/modules/queue/application/workflows";

import { researchDiscoverEdition } from "../briefings";
import { drawDiscoverCovers } from "../covers";
import { renderDiscoverEpisode } from "../episode-render";
import { produceDiscoverEpisode } from "../episodes";
import { fileDiscoverLinks } from "../follows";
import { runDiscoverGather } from "../gather";
import { produceDiscoverListen } from "../listen";
import { tidyDiscover } from "../retention";
import { produceSeasonListen } from "../season-listen";
import { produceYourWeek } from "../week";
import { renderDiscoverWindDown } from "../wind-down";

type EditionJob = Extract<DiscoverJobTaskData, { job: "edition" }>;

async function produceEpisode(
  context: ServiceContext,
  editionId: string,
  steps: TaskSteps,
): Promise<boolean> {
  const episode = await steps.value(
    "episode-script",
    discoverEpisodeResponseSchema.nullable(),
    () => produceDiscoverEpisode(context, editionId),
  );

  if (!episode) {
    return false;
  }

  await renderDiscoverEpisode(context, episode.episodeId, steps);

  return true;
}

async function produceFollowUps(
  context: ServiceContext,
  editionId: string,
  research: readonly DiscoverEditionFollowUp[],
  steps: TaskSteps,
): Promise<void> {
  await steps.run("research", async () => {
    await researchDiscoverEdition(context, editionId, research);
  });
  await settleAll([
    ...(research.includes("listen")
      ? [
          steps.run("listen", async () => {
            await produceDiscoverListen(context, editionId);
          }),
        ]
      : []),
    ...(research.includes("episode") ? [produceEpisode(context, editionId, steps)] : []),
  ]);
}

async function runEditionJob(
  context: ServiceContext,
  job: EditionJob,
  steps: TaskSteps,
): Promise<TaskResult> {
  const work = settleAll([
    ...(job.covers
      ? [
          steps.run("covers", async () => {
            await drawDiscoverCovers(context, job.editionId);
          }),
        ]
      : []),
    ...(job.research?.length
      ? [produceFollowUps(context, job.editionId, job.research, steps)]
      : []),
    ...(job.links
      ? [
          steps.run("links", async () => {
            await fileDiscoverLinks(context, job.editionId);
          }),
        ]
      : []),
    ...(job.yourWeek
      ? [
          steps.run("your-week", async () => {
            await produceYourWeek(context, job.editionId);
          }),
        ]
      : []),
  ]);

  try {
    await work;
  } finally {
    const today = job.tidy;

    if (today) {
      await steps.run("tidy", async () => {
        await tidyDiscover(context, today);
      });
    }
  }

  return { status: "success", message: "Edition follow-up work finished" };
}

async function runDiscoverJob(
  context: ServiceContext,
  job: DiscoverJobTaskData,
  steps: TaskSteps,
): Promise<TaskResult> {
  if (job.job === "edition") {
    return runEditionJob(context, job, steps);
  }

  if (job.job === "gather") {
    const startedAt = await steps.value("started", z.number(), async () => Date.now());
    const gathered = await runDiscoverGather(context, {
      scope: job.scope,
      now: new Date(startedAt),
      steps,
    });

    return {
      status: "success",
      message: `Read ${gathered.read.length} services, researched ${gathered.topics.length} topics and added ${gathered.added} feed items`,
    };
  }

  if (job.job === "episode") {
    return {
      status: "success",
      message: (await produceEpisode(context, job.editionId, steps))
        ? "Episode produced"
        : "This month's Discover budget is spent",
    };
  }

  if (job.job === "episode_chapter") {
    await renderDiscoverEpisode(context, job.episodeId, steps, job.chapter);

    return { status: "success", message: `Rendered from chapter ${job.chapter + 1}` };
  }

  if (job.job === "season_listen") {
    await steps.run("season-listen", async () => {
      await produceSeasonListen(context, job.seasonId);
    });

    return { status: "success", message: "Season listen saved" };
  }

  await steps.run("wind-down", () =>
    renderDiscoverWindDown(context, job.windDownId, {
      aboutToday: job.aboutToday,
      premise: job.premise,
      notes: job.notes,
    }),
  );

  return { status: "success", message: "Wind down recorded" };
}

export const discoverJob = defineTask<DiscoverJobTaskData>({
  payload: discoverJobTaskDataSchema,
  durable: true,
  handle: async (job, { env, message, execution }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "A Discover job requires an owner" };
    }

    return runDiscoverJob(
      job.runId ? withExecutionRunContext(owner, job.runId) : owner,
      job,
      execution.steps,
    );
  },
});

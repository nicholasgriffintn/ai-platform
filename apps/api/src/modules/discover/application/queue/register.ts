import {
  DISCOVER_JOB_TASK_TYPE,
  discoverJobTaskDataSchema,
  type DiscoverJobTaskData,
} from "@ngriffin_uk/polychat-schemas";

import { withExecutionRunContext } from "~/infrastructure/context/serviceContext";
import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask, type AppWorkflows } from "~/modules/queue/application/workflows";

import { researchDiscoverEdition } from "../briefings";
import { drawDiscoverCovers } from "../covers";
import { makeEpisodeStudySet } from "../episode-extras";
import { renderEpisodeChapter } from "../episode-render";
import { produceDiscoverEpisode } from "../episodes";
import { fileDiscoverLinks } from "../follows";
import { runDiscoverGather } from "../gather";
import { produceDiscoverListen } from "../listen";
import { tidyDiscover } from "../retention";
import { produceSeasonListen } from "../season-listen";
import { produceYourWeek } from "../week";
import { renderDiscoverWindDown } from "../wind-down";

const discoverJob = defineTask<DiscoverJobTaskData>({
  payload: discoverJobTaskDataSchema,
  handle: async (job, { env, message }) => {
    const owner = await loadUserContext(env, message.user_id);

    if (!owner) {
      return { status: "error", message: "A Discover job requires an owner" };
    }

    const context = job.runId ? withExecutionRunContext(owner, job.runId) : owner;

    if (job.job === "gather") {
      const gathered = await runDiscoverGather(context);

      return {
        status: "success",
        message: `Read ${gathered.read.length} services and researched ${gathered.topics.length} topics`,
      };
    }

    if (job.job === "wind_down") {
      await renderDiscoverWindDown(context, job.windDownId, {
        aboutToday: job.aboutToday,
        premise: job.premise,
        notes: job.notes,
      });

      return { status: "success", message: "Wind down recorded" };
    }

    if (job.job === "season_listen") {
      const sourceId = await produceSeasonListen(context, job.seasonId);

      return { status: "success", message: `Season listen saved as ${sourceId}` };
    }

    if (job.job === "episode") {
      const episode = await produceDiscoverEpisode(context, job.editionId);

      return {
        status: "success",
        message: episode
          ? `Episode ${episode.episodeId} scripted`
          : "This month's Discover budget is spent",
      };
    }

    if (job.job === "episode_chapter") {
      await renderEpisodeChapter(context, job.episodeId, job.chapter);

      return { status: "success", message: `Rendered chapter ${job.chapter + 1}` };
    }

    if (job.job === "research") {
      const researched = await researchDiscoverEdition(context, job.editionId, job.next);

      return { status: "success", message: `Researched ${researched} topics for the edition` };
    }

    if (job.job === "listen") {
      const listen = await produceDiscoverListen(context, job.editionId);

      return { status: "success", message: `Listen queued as ${listen.sourceId}` };
    }

    if (job.job === "episode_extras") {
      const made = await makeEpisodeStudySet(context, job.episodeId);

      return { status: "success", message: `Made ${made} study sets for the episode` };
    }

    if (job.job === "your_week") {
      const sourceId = await produceYourWeek(context, job.editionId);

      return {
        status: "success",
        message: sourceId ? `Your week is recording as ${sourceId}` : "A quiet week, so no recap",
      };
    }

    if (job.job === "tidy") {
      const tidied = await tidyDiscover(context, job.today);

      return {
        status: "success",
        message: `Archived ${tidied.editions} editions and ${tidied.links} unopened links`,
      };
    }

    if (job.job === "links") {
      const filed = await fileDiscoverLinks(context, job.editionId);

      return { status: "success", message: `Filed ${filed} links` };
    }

    const drawn = await drawDiscoverCovers(context, job.editionId);

    return { status: "success", message: `Drew ${drawn} covers` };
  },
});

export function registerDiscoverQueue(workflows: AppWorkflows): void {
  workflows.on(DISCOVER_JOB_TASK_TYPE, discoverJob);
}

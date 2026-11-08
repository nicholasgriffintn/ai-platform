import { STORIES_JOB_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { runStoriesMaintenance } from "../maintenance";
import { storiesJob } from "./stories-job";

export function registerStoriesQueue(workflows: AppWorkflows): void {
  workflows.on(STORIES_JOB_TASK_TYPE, storiesJob);
  workflows.every(
    SCHEDULES.STORIES_MAINTENANCE,
    defineSchedule({
      name: "stories-maintenance",
      run: async ({ env }) => {
        await runStoriesMaintenance(env);
      },
    }),
  );
}

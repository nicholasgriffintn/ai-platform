import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { refreshTitleIndex } from "~/modules/watching/application/title-index";

export function registerWatchingQueue(workflows: AppWorkflows): void {
  workflows.every(
    SCHEDULES.WATCHING_INDEX,
    defineSchedule({
      name: "watching-index-refresh",
      run: async ({ env }) => {
        await refreshTitleIndex(env);
      },
    }),
  );
}

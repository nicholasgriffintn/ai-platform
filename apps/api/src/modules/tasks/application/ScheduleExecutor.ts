import type { IEnv } from "~/types";

import { workflows } from "./registry";

export class ScheduleExecutor {
  public static async respondToCronSchedules(env: IEnv, event: ScheduledController): Promise<void> {
    await workflows.runCron(env, { cron: event.cron, scheduledTime: event.scheduledTime });
  }
}

import {
  DISCOVER_JOB_TASK_TYPE,
  type RecipeExecutionTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import type { TaskResult } from "~/modules/queue/application/types";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

import { queueDiscoverCurrent } from "./current";
import { readDiscoverDayProfile } from "./day-profile";
import { readCurrentDiscoverOccurrence } from "./routine-occurrence";

export async function executeDiscoverRoutineOccurrence(
  context: ServiceContext,
  data: RecipeExecutionTaskData,
  now = new Date(),
): Promise<TaskResult> {
  const user = context.requireUser();
  const occurrence = await readCurrentDiscoverOccurrence(context, data, now);

  if (!occurrence) {
    return { status: "skipped", message: "The Discover occurrence is no longer current" };
  }

  const { installationId, scheduled, operation } = occurrence;

  if (operation === "current") {
    const result = await queueDiscoverCurrent(context, now);

    return {
      status: result.status === "queued" ? "success" : "skipped",
      message: "Current Discover refresh evaluated",
      data: result,
    };
  }

  if (operation === "research" || operation === "feed") {
    await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
      id: `discover_${operation}_${installationId}_${data.occurrenceId}`,
      task_type: DISCOVER_JOB_TASK_TYPE,
      user_id: user.id,
      task_data: {
        job: "gather",
        scope: operation === "research" ? "full" : "feed",
        installationId,
        scheduledAt: scheduled.toISOString(),
      },
      priority: 6,
    });

    return { status: "success", message: `Discover ${operation} read queued` };
  }

  const profile = await readDiscoverDayProfile(context);
  const date = describeZonedInstant(scheduled, profile.timezone).date;
  const slot = operation === "morning_audio" ? "morning" : "evening";

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: `discover_audio_job_${user.id}_${date}_${slot}`,
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: user.id,
    task_data: { job: "audio", installationId, date, slot },
    priority: 6,
  });

  return { status: "success", message: "Scheduled Discover briefing queued" };
}

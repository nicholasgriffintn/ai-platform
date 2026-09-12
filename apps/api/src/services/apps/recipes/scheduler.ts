import { RepositoryManager } from "~/repositories";
import type { TemplateRecord } from "~/repositories/TemplateRepository";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import { doesCronMatchDate, getCronMatchingDatesInRange } from "~/utils/cron";
import { sha256Hex } from "~/utils/crypto";
import { getLogger } from "~/utils/logger";

import { parseStoredRecipeInstallationData } from "./installation-persistence";
import {
  buildRecipeScheduleState,
  getRecipeScheduleTriggerState,
  setRecipeScheduleLastRun,
} from "./scheduleState";
import { createRecipeExecutionTaskData } from "./task-data";
import { normaliseRecipeInstallationTriggers } from "./triggers";

const logger = getLogger({ prefix: "services/apps/recipes/scheduler" });
const RECIPE_SCHEDULER_POLL_INTERVAL_MINUTES = 15;

export const RECIPE_SCHEDULE_CATCH_UP_POLICY = {
  maximumOccurrencesPerTrigger: 4,
  maximumLookbackMinutes: 31 * 24 * 60,
} as const;

export { doesCronMatchDate };

function getScheduleRunKey(triggerId: string, date: Date): string {
  const minuteKey = date.toISOString().slice(0, 16);

  return `${triggerId}:${minuteKey}`;
}

async function getScheduleTaskId(params: {
  installationId: string;
  recipeId: string;
  userId: number;
  runKey: string;
}): Promise<string> {
  const digest = await sha256Hex(
    ["recipe_schedule", params.userId, params.installationId, params.recipeId, params.runKey].join(
      ":",
    ),
  );

  return `recipe_schedule_${digest.slice(0, 40)}`;
}

function getScheduleMinuteKey(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function getLastScheduledMinuteKey(
  runKey: string | undefined,
  triggerId: string,
): string | undefined {
  const prefix = `${triggerId}:`;

  return runKey?.startsWith(prefix) ? runKey.slice(prefix.length) : undefined;
}

function getScheduleEvaluationWindow(now: Date): { start: Date; end: Date } {
  const end = new Date(now);

  end.setUTCSeconds(0, 0);

  const startTime = end.getTime() - RECIPE_SCHEDULER_POLL_INTERVAL_MINUTES * 60 * 1000;

  return {
    start: new Date(startTime),
    end,
  };
}

function getCreatedAtDate(record: TemplateRecord): Date | null {
  const createdAt = new Date(record.created_at);

  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function getScheduleEvaluationDates(params: {
  cronExpression: string;
  windowStart: Date;
  windowEnd: Date;
  notBefore?: Date | null;
  timezone?: string;
}): Date[] {
  const start =
    params.notBefore && params.notBefore.getTime() > params.windowStart.getTime()
      ? params.notBefore
      : params.windowStart;

  if (start.getTime() > params.windowEnd.getTime()) {
    return [];
  }

  return getCronMatchingDatesInRange({
    cronExpression: params.cronExpression,
    start,
    end: params.windowEnd,
    includeStart: true,
    timezone: params.timezone,
    maximumMatches: RECIPE_SCHEDULE_CATCH_UP_POLICY.maximumOccurrencesPerTrigger,
    direction: "backward",
  });
}

function getMissedOccurrenceBoundary(params: {
  evaluationEnd: Date;
  activationBoundary: Date | null;
  lastScheduledMinuteKey?: string;
}): Date {
  const maximumLookback = new Date(
    params.evaluationEnd.getTime() -
      RECIPE_SCHEDULE_CATCH_UP_POLICY.maximumLookbackMinutes * 60 * 1000,
  );
  const lastScheduled = params.lastScheduledMinuteKey
    ? new Date(`${params.lastScheduledMinuteKey}:00.000Z`)
    : null;
  const afterLastScheduled =
    lastScheduled && !Number.isNaN(lastScheduled.getTime())
      ? new Date(lastScheduled.getTime() + 60 * 1000)
      : null;
  const candidates = [maximumLookback, params.activationBoundary, afterLastScheduled].filter(
    (candidate): candidate is Date => Boolean(candidate),
  );

  return new Date(Math.max(...candidates.map((candidate) => candidate.getTime())));
}

export async function scheduleDueRecipeExecutions(env: IEnv, now = new Date()): Promise<number> {
  const repositories = RepositoryManager.getInstance(env);
  const taskService = new TaskService(env, repositories.tasks);
  const records = await repositories.templates.listTemplatesByKind("recipe");
  const evaluationWindow = getScheduleEvaluationWindow(now);
  const enabledProjectRecipes = new Map<string, Set<string>>();
  let scheduledCount = 0;

  for (const record of records) {
    try {
      const installation = parseStoredRecipeInstallationData(record);
      const createdAt = getCreatedAtDate(record);

      if (
        !installation ||
        record.status !== "active" ||
        installation.status === "paused" ||
        !Array.isArray(installation.triggers)
      ) {
        continue;
      }

      const normalisedTriggers = await normaliseRecipeInstallationTriggers(
        installation.triggers,
        record.id,
      );
      const triggerIdsChanged = normalisedTriggers.some(
        (trigger, index) => trigger.id !== installation.triggers?.[index]?.id,
      );

      installation.triggers = normalisedTriggers;

      if (triggerIdsChanged) {
        installation.scheduleState = buildRecipeScheduleState({
          triggers: installation.triggers,
          existingState: installation.scheduleState,
          activatedAt: record.created_at,
        });
        const persisted = await repositories.templates.updateTemplate(record.id, {
          configuration: installation,
          status: record.status,
        });

        if (!persisted) {
          throw new Error("Failed to persist stable recipe trigger identities");
        }
      }

      if (record.project_id) {
        let enabledRecipes = enabledProjectRecipes.get(record.project_id);

        if (!enabledRecipes) {
          const capabilities = await repositories.workspaces.listProjectCapabilities(
            record.project_id,
          );

          enabledRecipes = new Set(
            capabilities
              .filter((capability) => capability.kind === "recipe")
              .map((capability) => capability.capability_id),
          );
          enabledProjectRecipes.set(record.project_id, enabledRecipes);
        }

        if (!enabledRecipes.has(installation.recipeId)) {
          continue;
        }
      }

      const scheduleState = buildRecipeScheduleState({
        triggers: installation.triggers,
        existingState: installation.scheduleState,
        activatedAt: record.created_at,
      });
      let changed = false;

      for (const [index, trigger] of installation.triggers.entries()) {
        if (!trigger.enabled || !trigger.id) {
          continue;
        }

        if (trigger.type === "once") {
          const scheduledAt = trigger.scheduledAt ? new Date(trigger.scheduledAt) : null;

          if (
            !scheduledAt ||
            Number.isNaN(scheduledAt.getTime()) ||
            scheduledAt > evaluationWindow.end
          ) {
            continue;
          }

          const runKey = getScheduleRunKey(trigger.id, scheduledAt);

          await taskService.enqueueTask({
            id: await getScheduleTaskId({
              installationId: record.id,
              recipeId: installation.recipeId,
              userId: record.created_by_user_id,
              runKey,
            }),
            task_type: "recipe_execution",
            user_id: record.created_by_user_id,
            project_id: record.project_id ?? undefined,
            task_data: createRecipeExecutionTaskData({
              recipeId: installation.recipeId,
              installationId: record.id,
              occurrenceId: runKey,
              projectId: record.project_id,
              input: trigger.prompt,
              channel: "scheduled",
              configuration: installation.configuration,
              notificationChannel: trigger.notificationChannel,
              notificationTarget: trigger.notificationTarget,
            }),
            priority: 5,
            metadata: {
              recipeId: installation.recipeId,
              installationId: record.id,
              triggerId: trigger.id,
              runKey,
            },
          });
          trigger.enabled = false;
          changed = true;
          scheduledCount++;
          continue;
        }

        if (trigger.type !== "schedule" || !trigger.cronExpression) {
          continue;
        }

        const triggerState = getRecipeScheduleTriggerState({
          state: scheduleState,
          triggerIndex: index,
          trigger,
        });

        if (!triggerState) {
          changed = true;
          continue;
        }

        const activatedAt = new Date(triggerState.activatedAt);
        const activationBoundary = Number.isNaN(activatedAt.getTime()) ? createdAt : activatedAt;
        const lastScheduledMinuteKey = getLastScheduledMinuteKey(
          triggerState.lastRunKey,
          trigger.id,
        );
        const evaluationDates = getScheduleEvaluationDates({
          cronExpression: trigger.cronExpression,
          windowStart: getMissedOccurrenceBoundary({
            evaluationEnd: evaluationWindow.end,
            activationBoundary,
            lastScheduledMinuteKey,
          }),
          windowEnd: evaluationWindow.end,
          notBefore: activationBoundary,
          timezone: trigger.timezone ?? "UTC",
        });

        for (const evaluationDate of evaluationDates) {
          const scheduledMinuteKey = getScheduleMinuteKey(evaluationDate);

          if (lastScheduledMinuteKey && scheduledMinuteKey <= lastScheduledMinuteKey) {
            continue;
          }

          const runKey = getScheduleRunKey(trigger.id, evaluationDate);

          await taskService.enqueueTask({
            id: await getScheduleTaskId({
              installationId: record.id,
              recipeId: installation.recipeId,
              userId: record.created_by_user_id,
              runKey,
            }),
            task_type: "recipe_execution",
            user_id: record.created_by_user_id,
            project_id: record.project_id ?? undefined,
            task_data: createRecipeExecutionTaskData({
              recipeId: installation.recipeId,
              installationId: record.id,
              occurrenceId: runKey,
              projectId: record.project_id,
              input: trigger.prompt,
              channel: "scheduled",
              configuration: installation.configuration,
              notificationChannel: trigger.notificationChannel,
              notificationTarget: trigger.notificationTarget,
            }),
            priority: 5,
            metadata: {
              recipeId: installation.recipeId,
              installationId: record.id,
              triggerId: trigger.id,
              runKey,
            },
          });

          setRecipeScheduleLastRun({
            state: scheduleState,
            triggerIndex: index,
            triggerId: trigger.id,
            cronExpression: trigger.cronExpression,
            timezone: trigger.timezone ?? "UTC",
            activatedAt: triggerState.activatedAt,
            runKey,
          });
          changed = true;
          scheduledCount++;
        }
      }

      if (changed) {
        await repositories.templates.updateTemplate(record.id, {
          configuration: { ...installation, scheduleState },
          status: record.status,
        });
      }
    } catch (error) {
      logger.error(`Failed to schedule recipe executions for installation ${record.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(`Scheduled ${scheduledCount} due recipe execution task(s)`);

  return scheduledCount;
}

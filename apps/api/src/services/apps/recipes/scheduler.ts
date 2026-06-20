import type { RecipeInstallationTrigger } from "@assistant/schemas";

import { RepositoryManager } from "~/repositories";
import type { AppData } from "~/repositories/AppDataRepository";
import { TaskService } from "~/services/tasks/TaskService";
import { doesCronMatchDate, getCronMatchingDatesInRange } from "~/utils/cron";
import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { RECIPE_INSTALLATION_APP_ID, RECIPE_INSTALLATION_ITEM_TYPE } from "./index";
import {
	buildRecipeScheduleState,
	getRecipeScheduleTriggerState,
	setRecipeScheduleLastRun,
	type RecipeScheduleState,
} from "./scheduleState";

const logger = getLogger({ prefix: "services/apps/recipes/scheduler" });
const RECIPE_SCHEDULER_POLL_INTERVAL_MINUTES = 15;

export { doesCronMatchDate };

interface StoredRecipeInstallationData {
	recipeId: string;
	status?: "active" | "paused";
	triggers?: RecipeInstallationTrigger[];
	configuration?: Record<string, unknown>;
	scheduleState?: RecipeScheduleState;
}

function parseStoredInstallation(record: AppData): StoredRecipeInstallationData | null {
	const parsed =
		typeof record.data === "string" ? safeParseJson(record.data) : (record.data as unknown);

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}

	const installation = parsed as StoredRecipeInstallationData;
	return installation.recipeId === record.item_id ? installation : null;
}

function getScheduleRunKey(triggerIndex: number, cronExpression: string, date: Date): string {
	const minuteKey = date.toISOString().slice(0, 16);
	return `${triggerIndex}:${cronExpression}:${minuteKey}`;
}

function getScheduleMinuteKey(date: Date): string {
	return date.toISOString().slice(0, 16);
}

function getLastScheduledMinuteKey(
	runKey: string | undefined,
	triggerIndex: number,
	cronExpression: string,
): string | undefined {
	const prefix = `${triggerIndex}:${cronExpression}:`;
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

function getCreatedAtDate(record: AppData): Date | null {
	const createdAt = new Date(record.created_at);
	return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function getScheduleEvaluationDates(params: {
	cronExpression: string;
	windowStart: Date;
	windowEnd: Date;
	notBefore?: Date | null;
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
	});
}

export async function scheduleDueRecipeExecutions(env: IEnv, now = new Date()): Promise<number> {
	const repositories = RepositoryManager.getInstance(env);
	const taskService = new TaskService(env, repositories.tasks);
	const records = await repositories.appData.getAppDataByApp(RECIPE_INSTALLATION_APP_ID);
	const evaluationWindow = getScheduleEvaluationWindow(now);
	let scheduledCount = 0;

	for (const record of records) {
		if (record.item_type !== RECIPE_INSTALLATION_ITEM_TYPE || !record.user_id) {
			continue;
		}

		const installation = parseStoredInstallation(record);
		const createdAt = getCreatedAtDate(record);
		if (
			!installation ||
			installation.status === "paused" ||
			!Array.isArray(installation.triggers)
		) {
			continue;
		}

		const scheduleState = buildRecipeScheduleState({
			triggers: installation.triggers,
			existingState: installation.scheduleState,
			activatedAt: record.created_at,
		});
		let changed = false;

		for (const [index, trigger] of installation.triggers.entries()) {
			if (trigger.type !== "schedule" || trigger.enabled === false || !trigger.cronExpression) {
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
				index,
				trigger.cronExpression,
			);
			const evaluationDates = getScheduleEvaluationDates({
				cronExpression: trigger.cronExpression,
				windowStart: evaluationWindow.start,
				windowEnd: evaluationWindow.end,
				notBefore: activationBoundary,
			});

			for (const evaluationDate of evaluationDates) {
				const scheduledMinuteKey = getScheduleMinuteKey(evaluationDate);
				if (lastScheduledMinuteKey && scheduledMinuteKey <= lastScheduledMinuteKey) {
					continue;
				}

				const runKey = getScheduleRunKey(index, trigger.cronExpression, evaluationDate);

				await taskService.enqueueTask({
					task_type: "recipe_execution",
					user_id: record.user_id,
					task_data: {
						recipeId: installation.recipeId,
						installationId: record.id,
						input: trigger.prompt,
						channel: "scheduled",
						configuration: installation.configuration,
						notificationChannel: trigger.notificationChannel,
						notificationTarget: trigger.notificationTarget,
					},
					priority: 5,
					metadata: {
						recipeId: installation.recipeId,
						installationId: record.id,
						triggerIndex: index,
						runKey,
					},
				});

				setRecipeScheduleLastRun({
					state: scheduleState,
					triggerIndex: index,
					cronExpression: trigger.cronExpression,
					activatedAt: triggerState.activatedAt,
					runKey,
				});
				changed = true;
				scheduledCount++;
			}
		}

		if (changed) {
			await repositories.appData.updateAppData(record.id, {
				...installation,
				scheduleState,
			});
		}
	}

	logger.info(`Scheduled ${scheduledCount} due recipe execution task(s)`);
	return scheduledCount;
}

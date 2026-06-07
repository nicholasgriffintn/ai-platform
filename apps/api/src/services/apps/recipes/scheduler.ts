import type { RecipeInstallationTrigger } from "@assistant/schemas";

import { RepositoryManager } from "~/repositories";
import type { AppData } from "~/repositories/AppDataRepository";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { RECIPE_INSTALLATION_APP_ID, RECIPE_INSTALLATION_ITEM_TYPE } from "./index";

const logger = getLogger({ prefix: "services/apps/recipes/scheduler" });

interface StoredRecipeInstallationData {
	recipeId: string;
	status?: "active" | "paused";
	triggers?: RecipeInstallationTrigger[];
	configuration?: Record<string, unknown>;
	lastScheduledRunKeys?: Record<string, string>;
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

function parseCronPart(part: string, value: number, options?: { sundayAlias?: boolean }): boolean {
	if (part === "*") {
		return true;
	}

	return part.split(",").some((token) => {
		const trimmed = token.trim();
		if (!trimmed) {
			return false;
		}

		if (trimmed.startsWith("*/")) {
			const step = Number.parseInt(trimmed.slice(2), 10);
			return Number.isFinite(step) && step > 0 && value % step === 0;
		}

		if (trimmed.includes("-")) {
			const [startValue, endValue] = trimmed.split("-").map((item) => Number.parseInt(item, 10));
			return (
				Number.isFinite(startValue) &&
				Number.isFinite(endValue) &&
				value >= startValue &&
				value <= endValue
			);
		}

		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isFinite(parsed)) {
			return false;
		}

		return value === parsed || (options?.sundayAlias === true && value === 0 && parsed === 7);
	});
}

export function doesCronMatchDate(cronExpression: string, date: Date): boolean {
	const parts = cronExpression.trim().split(/\s+/);
	if (parts.length !== 5) {
		return false;
	}

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
	return (
		parseCronPart(minute, date.getUTCMinutes()) &&
		parseCronPart(hour, date.getUTCHours()) &&
		parseCronPart(dayOfMonth, date.getUTCDate()) &&
		parseCronPart(month, date.getUTCMonth() + 1) &&
		parseCronPart(dayOfWeek, date.getUTCDay(), { sundayAlias: true })
	);
}

function getScheduleRunKey(triggerIndex: number, cronExpression: string, date: Date): string {
	const minuteKey = date.toISOString().slice(0, 16);
	return `${triggerIndex}:${cronExpression}:${minuteKey}`;
}

export async function scheduleDueRecipeExecutions(env: IEnv, now = new Date()): Promise<number> {
	const repositories = RepositoryManager.getInstance(env);
	const taskService = new TaskService(env, repositories.tasks);
	const records = await repositories.appData.getAppDataByApp(RECIPE_INSTALLATION_APP_ID);
	let scheduledCount = 0;

	for (const record of records) {
		if (record.item_type !== RECIPE_INSTALLATION_ITEM_TYPE || !record.user_id) {
			continue;
		}

		const installation = parseStoredInstallation(record);
		if (
			!installation ||
			installation.status === "paused" ||
			!Array.isArray(installation.triggers)
		) {
			continue;
		}

		const lastScheduledRunKeys = { ...(installation.lastScheduledRunKeys ?? {}) };
		let changed = false;

		for (const [index, trigger] of installation.triggers.entries()) {
			if (
				trigger.type !== "schedule" ||
				trigger.enabled === false ||
				!trigger.cronExpression ||
				!doesCronMatchDate(trigger.cronExpression, now)
			) {
				continue;
			}

			const triggerKey = String(index);
			const runKey = getScheduleRunKey(index, trigger.cronExpression, now);
			if (lastScheduledRunKeys[triggerKey] === runKey) {
				continue;
			}

			await taskService.enqueueTask({
				task_type: "recipe_execution",
				user_id: record.user_id,
				task_data: {
					recipeId: installation.recipeId,
					installationId: record.id,
					input: trigger.prompt,
					channel: "scheduled",
					configuration: installation.configuration,
				},
				priority: 5,
				metadata: {
					recipeId: installation.recipeId,
					installationId: record.id,
					triggerIndex: index,
					runKey,
				},
			});

			lastScheduledRunKeys[triggerKey] = runKey;
			changed = true;
			scheduledCount++;
		}

		if (changed) {
			await repositories.appData.updateAppData(record.id, {
				...installation,
				lastScheduledRunKeys,
			});
		}
	}

	logger.info(`Scheduled ${scheduledCount} due recipe execution task(s)`);
	return scheduledCount;
}

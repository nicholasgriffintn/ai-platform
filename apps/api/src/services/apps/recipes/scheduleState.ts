import type { RecipeInstallationTrigger } from "@assistant/schemas";

export interface RecipeScheduleTriggerState {
	cronExpression: string;
	enabled: boolean;
	activatedAt: string;
	lastRunKey?: string;
}

export type RecipeScheduleState = Record<string, RecipeScheduleTriggerState>;

function getScheduleStateKey(triggerIndex: number): string {
	return String(triggerIndex);
}

function isScheduleTrigger(
	trigger: RecipeInstallationTrigger,
): trigger is RecipeInstallationTrigger & { cronExpression: string } {
	return trigger.type === "schedule" && Boolean(trigger.cronExpression?.trim());
}

function normaliseActivatedAt(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function buildRecipeScheduleState(params: {
	triggers: RecipeInstallationTrigger[];
	existingState?: RecipeScheduleState;
	activatedAt: string;
}): RecipeScheduleState {
	const activatedAt = normaliseActivatedAt(params.activatedAt);
	const state: RecipeScheduleState = {};

	for (const [index, trigger] of params.triggers.entries()) {
		if (!isScheduleTrigger(trigger)) {
			continue;
		}

		const key = getScheduleStateKey(index);
		const enabled = trigger.enabled !== false;
		const existing = params.existingState?.[key];
		if (existing?.cronExpression === trigger.cronExpression && existing.enabled === enabled) {
			state[key] = existing;
			continue;
		}

		state[key] = {
			cronExpression: trigger.cronExpression,
			enabled,
			activatedAt,
		};
	}

	return state;
}

export function getRecipeScheduleTriggerState(params: {
	state?: RecipeScheduleState;
	triggerIndex: number;
	trigger: RecipeInstallationTrigger;
}): RecipeScheduleTriggerState | undefined {
	if (!isScheduleTrigger(params.trigger)) {
		return undefined;
	}

	const state = params.state?.[getScheduleStateKey(params.triggerIndex)];
	const enabled = params.trigger.enabled !== false;
	if (
		!state ||
		state.cronExpression !== params.trigger.cronExpression ||
		state.enabled !== enabled
	) {
		return undefined;
	}

	return state;
}

export function setRecipeScheduleLastRun(params: {
	state: RecipeScheduleState;
	triggerIndex: number;
	cronExpression: string;
	activatedAt: string;
	runKey: string;
}): void {
	const key = getScheduleStateKey(params.triggerIndex);
	const existing = params.state[key];
	params.state[key] = {
		cronExpression: params.cronExpression,
		enabled: true,
		activatedAt: existing?.activatedAt ?? normaliseActivatedAt(params.activatedAt),
		lastRunKey: params.runKey,
	};
}

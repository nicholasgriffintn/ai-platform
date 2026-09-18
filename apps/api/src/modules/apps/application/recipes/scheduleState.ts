import type { RecipeInstallationTrigger } from "@ngriffin_uk/polychat-schemas";

export interface RecipeScheduleTriggerState {
  triggerId?: string;
  cronExpression: string;
  timezone?: string;
  enabled: boolean;
  activatedAt: string;
  lastRunKey?: string;
}

export type RecipeScheduleState = Record<string, RecipeScheduleTriggerState>;

function getScheduleStateKey(trigger: RecipeInstallationTrigger, triggerIndex: number): string {
  return trigger.id ?? String(triggerIndex);
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

    const key = getScheduleStateKey(trigger, index);
    const enabled = trigger.enabled;
    const existing = params.existingState?.[key] ?? params.existingState?.[String(index)];
    const timezone = trigger.timezone ?? "UTC";

    if (
      existing?.cronExpression === trigger.cronExpression &&
      existing.enabled === enabled &&
      (existing.timezone ?? "UTC") === timezone
    ) {
      state[key] = { ...existing, triggerId: trigger.id ?? key, timezone };
      continue;
    }

    state[key] = {
      triggerId: trigger.id ?? key,
      cronExpression: trigger.cronExpression,
      timezone,
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

  const key = getScheduleStateKey(params.trigger, params.triggerIndex);
  const state = params.state?.[key] ?? params.state?.[String(params.triggerIndex)];
  const enabled = params.trigger.enabled;

  if (
    !state ||
    state.cronExpression !== params.trigger.cronExpression ||
    (state.timezone ?? "UTC") !== (params.trigger.timezone ?? "UTC") ||
    state.enabled !== enabled
  ) {
    return undefined;
  }

  return state;
}

export function setRecipeScheduleLastRun(params: {
  state: RecipeScheduleState;
  triggerIndex: number;
  triggerId?: string;
  cronExpression: string;
  timezone?: string;
  activatedAt: string;
  runKey: string;
}): void {
  const key = params.triggerId ?? String(params.triggerIndex);
  const existing = params.state[key];

  params.state[key] = {
    triggerId: params.triggerId ?? existing?.triggerId ?? key,
    cronExpression: params.cronExpression,
    timezone: params.timezone ?? existing?.timezone ?? "UTC",
    enabled: true,
    activatedAt: existing?.activatedAt ?? normaliseActivatedAt(params.activatedAt),
    lastRunKey: params.runKey,
  };
}

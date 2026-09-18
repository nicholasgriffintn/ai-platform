import { getCronMatchingDatesInRange } from "@ngriffin_uk/polychat-utility-server/cron";

export type ScheduleDefinition = { every: string | number } | { cron: string; timezone?: string };

const INTERVAL_UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseInterval(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid interval: ${value}`);
    }

    return value;
  }

  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)\s*$/.exec(value);

  if (!match) {
    throw new Error(`Invalid interval: "${value}"`);
  }

  return Number(match[1]) * INTERVAL_UNITS[match[2]];
}

export function nextRunAt(schedule: ScheduleDefinition, after: Date): Date | null {
  if ("every" in schedule) {
    return new Date(after.getTime() + parseInterval(schedule.every));
  }

  const [next] = getCronMatchingDatesInRange({
    cronExpression: schedule.cron,
    start: new Date(after.getTime() + 60_000),
    end: new Date(after.getTime() + 366 * 86_400_000),
    includeStart: true,
    timezone: schedule.timezone,
    maximumMatches: 1,
  });

  return next ?? null;
}

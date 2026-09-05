export function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normaliseIsoDateTime(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new RangeError("Invalid date-time value");
  }

  return new Date(timestamp).toISOString();
}

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekDay: number;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format();

    return true;
  } catch {
    return false;
  }
}

export function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekDay: WEEK_DAYS.indexOf(values.weekday ?? ""),
  };
}

export function findNextZonedTime(params: {
  after: Date;
  timeZone: string;
  localTime: string;
  allowedWeekDays?: ReadonlySet<number>;
}): Date {
  const [hour, minute] = params.localTime.split(":").map(Number);
  const firstMinute = Math.floor(params.after.getTime() / 60_000) * 60_000 + 60_000;
  const lastMinute = firstMinute + 8 * 24 * 60 * 60_000;

  for (let timestamp = firstMinute; timestamp <= lastMinute; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const local = getZonedDateTimeParts(candidate, params.timeZone);

    if (
      local.hour === hour &&
      local.minute === minute &&
      (!params.allowedWeekDays || params.allowedWeekDays.has(local.weekDay))
    ) {
      return candidate;
    }
  }

  throw new RangeError("Could not resolve the next scheduled time");
}

export function findZonedDateTime(params: {
  timeZone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): Date | null {
  const estimate = Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute);
  const start = estimate - 18 * 60 * 60_000;
  const end = estimate + 18 * 60 * 60_000;

  for (let timestamp = start; timestamp <= end; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const local = getZonedDateTimeParts(candidate, params.timeZone);

    if (
      local.year === params.year &&
      local.month === params.month &&
      local.day === params.day &&
      local.hour === params.hour &&
      local.minute === params.minute
    ) {
      return candidate;
    }
  }

  return null;
}

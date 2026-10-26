import { readOptionalString } from "./objects.js";

export const DAY_MS = 86_400_000;

export function isoDaysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export function formatDate(dateString: string): string {
  if (!dateString) {
    return "N/A";
  }

  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatClockTime(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return date.toDateString() === now.toDateString()
    ? time
    : `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

export function isDeadlinePassed(deadline: unknown, now: Date | string = new Date()): boolean {
  const value = readOptionalString(deadline);

  if (value === undefined || value === "") {
    return false;
  }

  const deadlineMs = Date.parse(value);
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();

  return Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && deadlineMs <= nowMs;
}

export function parseTimestamp(dateString: string): Date {
  return new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)
      ? `${dateString.replace(" ", "T")}Z`
      : dateString,
  );
}

export function formatRelativeTime(dateString: string, now = new Date()): string {
  const date = parseTimestamp(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  }

  if (months > 0) {
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }

  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  return "just now";
}

export function epochSecondsToIso(value: unknown): string | null {
  const seconds =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

export function calendarDateFromParts(year: number, month: number, day: number): string | null {
  if (![year, month, day].every(Number.isInteger) || year < 1000 || year > 9999) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function listMonthNames(locale?: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });

  return Array.from({ length: 12 }, (_, monthIndex) =>
    format.format(new Date(Date.UTC(2000, monthIndex, 1))),
  );
}

export function wholeYearsSince(calendarDate: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calendarDate);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    calendarDateFromParts(year, month, day) !== calendarDate ||
    Date.UTC(year, month - 1, day) > now.getTime()
  ) {
    return null;
  }

  const hasReachedAnniversary =
    now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);

  return now.getUTCFullYear() - year - (hasReachedAnniversary ? 0 : 1);
}

const RELATIVE_AGE = /^(\d+)\s+(minute|hour|day|week)s?\s+ago$/iu;
const RELATIVE_UNIT_MS = new Map([
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", DAY_MS],
  ["week", 7 * DAY_MS],
]);

export function publishedCalendarDate(value: string | undefined, now = Date.now()): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);

  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  const relative = RELATIVE_AGE.exec(value.trim());
  const unit = relative?.[2] ? RELATIVE_UNIT_MS.get(relative[2].toLowerCase()) : undefined;

  if (!relative?.[1] || unit === undefined) {
    return "";
  }

  return new Date(now - Number(relative[1]) * unit).toISOString().slice(0, 10);
}

export function hoursBetween(start: string, end: string): number {
  return Math.max(0, Date.parse(end) - Date.parse(start)) / 3_600_000;
}

export interface ZonedInstant {
  iso: string;
  unixSeconds: number;
  timeZone: string;
  date: string;
  time: string;
  weekday: string;
  utcOffset: string;
}

export function readLocalTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

export function describeZonedInstant(instant: Date, timeZone = "UTC"): ZonedInstant {
  const parts = new Map(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "long",
      timeZoneName: "longOffset",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const offset = (parts.get("timeZoneName") ?? "GMT").replace("GMT", "");

  return {
    iso: instant.toISOString(),
    unixSeconds: Math.floor(instant.getTime() / 1000),
    timeZone,
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`,
    weekday: parts.get("weekday") ?? "",
    utcOffset: offset || "+00:00",
  };
}

export function zonedTimeToInstant(calendarDate: string, hour: number, timeZone = "UTC"): Date {
  const [year, month, day] = calendarDate.split("-").map(Number);
  let instant = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour));

  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = describeZonedInstant(instant, timeZone);
    const [zonedHour, zonedMinute] = zoned.time.split(":").map(Number);
    const wanted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour));
    const seen = new Date(
      `${zoned.date}T${String(zonedHour).padStart(2, "0")}:${String(zonedMinute).padStart(2, "0")}:00Z`,
    );
    const drift = seen.getTime() - wanted.getTime();

    if (drift === 0) {
      break;
    }

    instant = new Date(instant.getTime() - drift);
  }

  return instant;
}

export function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);

  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10);
}

export function isoWeekKey(calendarDate: string): string {
  const date = new Date(`${calendarDate}T00:00:00Z`);
  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);

  return `${date.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

export type PartOfDay = "morning" | "afternoon" | "evening";

export function partOfDay(hour: number): PartOfDay {
  if (hour < 12) {
    return "morning";
  }

  return hour < 18 ? "afternoon" : "evening";
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function readZonedClock(
  date: Date,
  timeZone: string,
): { weekday: number; time: string; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Mon"] ?? 1,
    time: `${parts.hour}:${parts.minute}`,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function parseStoredTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

  return Number.isNaN(parsed) ? 0 : parsed;
}

export const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

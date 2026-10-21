import { readOptionalString } from "./objects.js";

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

export function formatRelativeTime(dateString: string, now = new Date()): string {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)
      ? `${dateString.replace(" ", "T")}Z`
      : dateString,
  );
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

export function parseTimestampMs(value: string | null | undefined): number | null {
  const parsed = value ? Date.parse(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

export function epochSecondsToIso(value: unknown): string | null {
  const seconds =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
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

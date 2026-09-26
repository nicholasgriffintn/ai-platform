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

export function epochSecondsToIso(value: unknown): string | null {
  const seconds =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

export function hoursBetween(start: string, end: string): number {
  return Math.max(0, Date.parse(end) - Date.parse(start)) / 3_600_000;
}

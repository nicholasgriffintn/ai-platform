import type { DeviceActivityStatus } from "@ngriffin_uk/polychat-schemas";
import { formatClockTime, formatConjunctionList } from "@ngriffin_uk/polychat-utility-core";

const SOURCE_NAMES: Record<DeviceActivityStatus["sharing"][number], string> = {
  browsing: "browsing",
  agents: "coding agents",
  apps: "apps",
  music: "music",
  games: "games",
};

export function describeActivityStatus(status: DeviceActivityStatus): string {
  if (!status.enabled) {
    return "Off. Nothing on this Mac is read or sent.";
  }

  const sent = status.lastSentAt ? ` Last sent ${formatClockTime(status.lastSentAt)}.` : "";

  if (status.paused) {
    return status.pausedUntil
      ? `Paused until ${formatClockTime(status.pausedUntil)}.${sent}`
      : `Paused until you resume.${sent}`;
  }

  if (status.sharing.length === 0) {
    return `On, but no sources are chosen yet.${sent}`;
  }

  return `Sharing ${formatConjunctionList(status.sharing.map((source) => SOURCE_NAMES[source]))}.${sent}`;
}

import {
  DEVICE_ACTIVITY_PROVIDER_PREFIX,
  DEVICE_ACTIVITY_SOURCES,
  deviceActivitySourceSchema,
  type DeviceActivitySource,
  type MachineActivityItem,
} from "@ngriffin_uk/polychat-schemas";
import { readUrlHost } from "@ngriffin_uk/polychat-utility-core";

import { mergeDailyLog, parseDailyLog, renderDailyLog, type DailyLogDay } from "./daily-log";
import type { DiscoverResearchResult } from "./research";
import type { DiscoverSignalGroup } from "./signal-catalogue";

export const DEVICE_ACTIVITY_MACHINE_METADATA_KEY = "deviceMachineId";
export const DEVICE_ACTIVITY_DAYS_KEPT = 7;

const DEVICE_SOURCE_DETAILS: Record<
  DeviceActivitySource,
  { name: string; description: string; group: DiscoverSignalGroup; contextNote?: string }
> = {
  browsing: {
    name: "Browsing on your Mac",
    description: "Sites and pages from the browsers you share on the desktop app.",
    group: "reading",
    contextNote: "They have already opened these pages, so never offer one as a read card",
  },
  agents: {
    name: "Coding agents on your Mac",
    description: "Claude Code and Codex sessions from the desktop app.",
    group: "work",
    contextNote:
      "Each session is work they already handed to a coding agent, so treat it as done or in hand: never an interest and never an action card",
  },
  apps: {
    name: "Apps on your Mac",
    description: "Time spent in the apps you use, from the desktop app.",
    group: "work",
  },
  music: {
    name: "Music on your Mac",
    description: "What Apple Music and Spotify played, from the desktop app.",
    group: "listening",
  },
  games: {
    name: "Games on your Mac",
    description: "What you played, from the desktop app.",
    group: "playing",
  },
};

const DEVICE_DOCUMENT_TITLES: Record<DeviceActivitySource, string> = {
  browsing: "Browsing",
  agents: "Coding agents",
  apps: "Apps",
  music: "Music",
  games: "Games",
};

export function deviceActivityProviderId(source: DeviceActivitySource): string {
  return `${DEVICE_ACTIVITY_PROVIDER_PREFIX}${source}`;
}

export function readDeviceActivitySource(providerId: string): DeviceActivitySource | null {
  if (!providerId.startsWith(DEVICE_ACTIVITY_PROVIDER_PREFIX)) {
    return null;
  }

  const parsed = deviceActivitySourceSchema.safeParse(
    providerId.slice(DEVICE_ACTIVITY_PROVIDER_PREFIX.length),
  );

  return parsed.success ? parsed.data : null;
}

export function deviceActivitySignalId(machineId: string, source: DeviceActivitySource): string {
  return `${deviceActivityProviderId(source)}:${machineId}`;
}

export function deviceActivityDocumentTitle(source: DeviceActivitySource, label: string): string {
  return `${DEVICE_DOCUMENT_TITLES[source]} on ${label}`;
}

export function describeDeviceActivitySource(source: DeviceActivitySource): {
  name: string;
  description: string;
} {
  const { name, description } = DEVICE_SOURCE_DETAILS[source];

  return { name, description };
}

export function deviceActivityGroup(providerId: string): DiscoverSignalGroup | null {
  const source = readDeviceActivitySource(providerId);

  return source ? DEVICE_SOURCE_DETAILS[source].group : null;
}

export function deviceActivityContextNote(providerId: string): string | null {
  const source = readDeviceActivitySource(providerId);

  return (source && DEVICE_SOURCE_DETAILS[source].contextNote) || null;
}

export function renderDeviceActivityHistory(
  title: string,
  existing: string,
  today: DailyLogDay,
): string {
  const days = mergeDailyLog(parseDailyLog(existing), today, DEVICE_ACTIVITY_DAYS_KEPT);

  return [`# ${title}`, days.length > 0 ? renderDailyLog(days) : "Nothing shared yet."].join(
    "\n\n",
  );
}

export function listDeviceActivityProviders(
  present: Iterable<string>,
  excluded: readonly string[],
): DeviceActivitySource[] {
  const known = new Set<string>([...present, ...excluded]);

  return DEVICE_ACTIVITY_SOURCES.filter((source) => known.has(deviceActivityProviderId(source)));
}

export function readDeviceActivityPages(
  items: readonly MachineActivityItem[],
  date: string,
): DiscoverResearchResult[] {
  return items.flatMap((item) =>
    item.url
      ? [{ title: item.title, url: item.url, snippet: "", source: readUrlHost(item.url), date }]
      : [],
  );
}

export function describeDeviceActivityItems(items: readonly MachineActivityItem[]): string[] {
  return items.map((item) => {
    if (item.url) {
      return `Read “${item.title}” (${item.url})`;
    }

    return item.detail ? `${item.title}: ${item.detail}` : item.title;
  });
}

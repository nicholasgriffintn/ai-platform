import {
  DEVICE_ACTIVITY_PROVIDER_PREFIX,
  DEVICE_ACTIVITY_SOURCES,
  deviceActivitySourceSchema,
  type DeviceActivitySource,
} from "@ngriffin_uk/polychat-schemas";

export const DEVICE_ACTIVITY_MACHINE_METADATA_KEY = "deviceMachineId";

const DEVICE_SOURCE_DETAILS: Record<DeviceActivitySource, { name: string; description: string }> = {
  browsing: {
    name: "Browsing on your Mac",
    description: "Sites and pages from the browsers you share on the desktop app.",
  },
  agents: {
    name: "Coding agents on your Mac",
    description: "Claude Code and Codex sessions from the desktop app.",
  },
  apps: {
    name: "Apps on your Mac",
    description: "Time spent in the apps you use, from the desktop app.",
  },
  music: {
    name: "Music on your Mac",
    description: "What Apple Music and Spotify played, from the desktop app.",
  },
  games: {
    name: "Games on your Mac",
    description: "What you played, from the desktop app.",
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
  return DEVICE_SOURCE_DETAILS[source];
}

export function listDeviceActivityProviders(
  present: Iterable<string>,
  excluded: readonly string[],
): DeviceActivitySource[] {
  const known = new Set<string>([...present, ...excluded]);

  return DEVICE_ACTIVITY_SOURCES.filter((source) => known.has(deviceActivityProviderId(source)));
}

import type { DiscoverDayProfile, DiscoverObservation } from "@ngriffin_uk/polychat-schemas";
import { haversineKm } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  readConnectorLineStatus,
  readConnectorNearbyLines,
} from "~/modules/connectors/application/places";
import {
  describeDiscoverLineStatus,
  selectDiscoverLines,
} from "~/modules/discover/domain/line-status";
import type { DiscoverLiveContent } from "~/modules/discover/domain/live";

import type { DiscoverRoutineSettings } from "./settings";

const NEARBY_REUSE_KM = 0.3;
const NEARBY_REUSE_MS = 24 * 60 * 60 * 1000;

type DiscoverLineState = Pick<DiscoverLiveContent, "deviceLocation" | "nearbyLines">;

export function currentDiscoverDeviceLocation(live: DiscoverLineState, now: Date) {
  return live.deviceLocation && live.deviceLocation.expiresAt > now.toISOString()
    ? live.deviceLocation
    : null;
}

async function resolveNearbyLines(
  context: ServiceContext,
  live: DiscoverLineState,
  now: Date,
): Promise<DiscoverLiveContent["nearbyLines"]> {
  const location = currentDiscoverDeviceLocation(live, now);

  if (!location) {
    return live.nearbyLines;
  }

  const cached = live.nearbyLines;

  if (
    cached &&
    now.getTime() - Date.parse(cached.checkedAt) < NEARBY_REUSE_MS &&
    haversineKm(
      { lat: cached.latitude, lng: cached.longitude },
      { lat: location.latitude, lng: location.longitude },
    ) < NEARBY_REUSE_KM
  ) {
    return cached;
  }

  try {
    const lines = await readConnectorNearbyLines(context, location);

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      lines: lines.slice(0, 40),
      checkedAt: now.toISOString(),
    };
  } catch {
    return cached;
  }
}

export async function gatherDiscoverLineStatus(
  context: ServiceContext,
  input: {
    profile: DiscoverDayProfile;
    settings: DiscoverRoutineSettings;
    live: DiscoverLineState;
    previous: readonly DiscoverObservation[];
    now: Date;
  },
): Promise<{
  observations: DiscoverObservation[];
  nearbyLines: DiscoverLiveContent["nearbyLines"];
}> {
  const { profile, settings, live, previous, now } = input;
  const preferences = profile.lineStatus;

  if (!preferences.enabled || settings.excludedProviders.includes("tfl")) {
    return { observations: [], nearbyLines: live.nearbyLines };
  }

  const nearbyLines = preferences.nearby
    ? await resolveNearbyLines(context, live, now)
    : live.nearbyLines;
  const nearby = nearbyLines && currentDiscoverDeviceLocation(live, now) ? nearbyLines.lines : [];
  const lines = selectDiscoverLines(preferences, nearby);

  if (lines.length === 0) {
    return { observations: [], nearbyLines };
  }

  try {
    const readings = await readConnectorLineStatus(context, lines);

    return { observations: describeDiscoverLineStatus(readings, { lines, now }), nearbyLines };
  } catch {
    return {
      observations: previous
        .filter((observation) => observation.kind === "lines")
        .map((observation) => ({ ...observation, stale: true })),
      nearbyLines,
    };
  }
}

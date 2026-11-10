import type {
  DiscoverDeviceLocation,
  DiscoverRefreshResponse,
} from "@ngriffin_uk/polychat-schemas";
import { haversineKm } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { queueDiscoverCurrent, refreshDiscoverNow } from "./current";
import { currentDiscoverDeviceLocation } from "./line-status";
import { updateDiscoverLive } from "./live-store";

const LOCATION_LIFETIME_MS = 2 * 60 * 60 * 1000;
const MOVED_KM = 0.3;

function coarse(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function saveDiscoverDeviceLocation(
  context: ServiceContext,
  input: DiscoverDeviceLocation,
  now = new Date(),
): Promise<DiscoverRefreshResponse> {
  const location = { latitude: coarse(input.latitude), longitude: coarse(input.longitude) };

  let moved = false;

  await updateDiscoverLive(context, (content) => {
    const known = currentDiscoverDeviceLocation(content, now);

    moved =
      !known ||
      haversineKm(
        { lat: known.latitude, lng: known.longitude },
        { lat: location.latitude, lng: location.longitude },
      ) >= MOVED_KM;

    return {
      ...content,
      checkedAt: moved ? null : content.checkedAt,
      deviceLocation: {
        ...location,
        observedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + LOCATION_LIFETIME_MS).toISOString(),
      },
    };
  });

  if (moved) {
    return refreshDiscoverNow(context, now);
  }

  return queueDiscoverCurrent(context, now);
}

export async function clearDiscoverDeviceLocation(context: ServiceContext): Promise<void> {
  await updateDiscoverLive(context, (content) => ({
    ...content,
    checkedAt: content.deviceLocation ? null : content.checkedAt,
    deviceLocation: null,
    nearbyLines: null,
  }));
}

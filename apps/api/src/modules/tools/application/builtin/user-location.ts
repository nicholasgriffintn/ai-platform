import { isValidGeoPoint } from "@ngriffin_uk/polychat-utility-core";

import type { IBody, IUser } from "~/types";

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  source: "device" | "network";
}

function toCoordinates(
  location: { latitude?: number; longitude?: number } | undefined,
  source: UserCoordinates["source"],
): UserCoordinates | null {
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return isValidGeoPoint({ lat: latitude, lng: longitude })
    ? { latitude, longitude, source }
    : null;
}

export interface UserLocationSource {
  request?: Pick<IBody, "location">;
  user?: Pick<IUser, "latitude" | "longitude">;
}

export function resolveUserCoordinates(request: UserLocationSource): UserCoordinates | null {
  return (
    toCoordinates(request.request?.location, "device") ?? toCoordinates(request.user, "network")
  );
}

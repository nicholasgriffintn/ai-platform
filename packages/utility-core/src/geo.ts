export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const EQUAL_EARTH_A1 = 1.340264;
const EQUAL_EARTH_A2 = -0.081106;
const EQUAL_EARTH_A3 = 0.000893;
const EQUAL_EARTH_A4 = 0.003796;
const EQUAL_EARTH_M = Math.sqrt(3) / 2;
const EQUAL_EARTH_ITERATIONS = 12;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function equalEarthY(theta: number): number {
  const theta2 = theta * theta;
  const theta6 = theta2 * theta2 * theta2;

  return (
    theta *
    (EQUAL_EARTH_A1 + EQUAL_EARTH_A2 * theta2 + theta6 * (EQUAL_EARTH_A3 + EQUAL_EARTH_A4 * theta2))
  );
}

function equalEarthYDerivative(theta: number): number {
  const theta2 = theta * theta;
  const theta6 = theta2 * theta2 * theta2;

  return (
    EQUAL_EARTH_A1 +
    3 * EQUAL_EARTH_A2 * theta2 +
    theta6 * (7 * EQUAL_EARTH_A3 + 9 * EQUAL_EARTH_A4 * theta2)
  );
}

export function projectEqualEarth(point: GeoPoint): ProjectedPoint {
  const lambda = toRadians(point.lng);
  const theta = Math.asin(EQUAL_EARTH_M * Math.sin(toRadians(point.lat)));

  return {
    x: (lambda * Math.cos(theta)) / (EQUAL_EARTH_M * equalEarthYDerivative(theta)),
    y: equalEarthY(theta),
  };
}

export function invertEqualEarth(projected: ProjectedPoint): GeoPoint {
  let theta = projected.y;

  for (let iteration = 0; iteration < EQUAL_EARTH_ITERATIONS; iteration += 1) {
    theta -= (equalEarthY(theta) - projected.y) / equalEarthYDerivative(theta);
  }

  const lambda = (EQUAL_EARTH_M * projected.x * equalEarthYDerivative(theta)) / Math.cos(theta);

  return {
    lat: toDegrees(Math.asin(Math.max(-1, Math.min(1, Math.sin(theta) / EQUAL_EARTH_M)))),
    lng: toDegrees(lambda),
  };
}

export const EQUAL_EARTH_EXTENT = {
  x: projectEqualEarth({ lat: 0, lng: 180 }).x,
  y: projectEqualEarth({ lat: 90, lng: 0 }).y,
} as const;

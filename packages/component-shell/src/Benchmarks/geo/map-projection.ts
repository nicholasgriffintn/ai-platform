import {
  EQUAL_EARTH_EXTENT,
  invertEqualEarth,
  isValidGeoPoint,
  projectEqualEarth,
  type GeoPoint,
} from "@ngriffin_uk/polychat-utility-core";

import { WORLD_OUTLINE } from "./world-outline.js";

export function toMapPoint(point: GeoPoint): { x: number; y: number } {
  const projected = projectEqualEarth(point);

  return {
    x: (projected.x + EQUAL_EARTH_EXTENT.x) * WORLD_OUTLINE.scale,
    y: (EQUAL_EARTH_EXTENT.y - projected.y) * WORLD_OUTLINE.scale,
  };
}

export function fromMapPoint(x: number, y: number): GeoPoint | null {
  const point = invertEqualEarth({
    x: x / WORLD_OUTLINE.scale - EQUAL_EARTH_EXTENT.x,
    y: EQUAL_EARTH_EXTENT.y - y / WORLD_OUTLINE.scale,
  });

  return isValidGeoPoint(point) ? point : null;
}

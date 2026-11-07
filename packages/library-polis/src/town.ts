import {
  BUILDING_FACTORY,
  BUILDING_FARM,
  BUILDING_FLATS,
  BUILDING_HALL,
  BUILDING_HOSPITAL,
  BUILDING_HOUSE,
  BUILDING_OFFICE,
  BUILDING_PARK,
  BUILDING_PLAZA,
  BUILDING_SCHOOL,
  BUILDING_SHOP,
  BUILDING_TERRACE,
} from "./constants.js";
import { random, randomInt, type Seeded } from "./random.js";

export const BLOCK_WIDTH = 132;
export const BLOCK_HEIGHT = 100;
export const ROAD_WIDTH = 14;
export const RIVER_HEIGHT = 44;

export const ZONE_HOUSES = 0;
export const ZONE_TERRACES = 1;
export const ZONE_FLATS = 2;
export const ZONE_SHOPS = 3;
export const ZONE_OFFICES = 4;
export const ZONE_INDUSTRY = 5;
export const ZONE_FARMS = 6;
export const ZONE_PARK = 7;
export const ZONE_CIVIC = 8;

export interface Town {
  width: number;
  height: number;
  columns: number;
  rows: number;
  roadX: number[];
  roadY: number[];
  riverTop: number;
  zones: Uint8Array;
  blockX: Float32Array;
  blockY: Float32Array;
  buildingCount: number;
  kind: Uint8Array;
  x: Float32Array;
  y: Float32Array;
  w: Float32Array;
  h: Float32Array;
  block: Int32Array;
  firstHome: Int32Array;
  homeCount: Int32Array;
  builtHomes: Int32Array;
  variant: Uint8Array;
  plaza: number;
  parks: number[];
  shops: number[];
  schools: number[];
}

interface Lot {
  kind: number;
  x: number;
  y: number;
  w: number;
  h: number;
  block: number;
}

function layoutZones(rng: Seeded, columns: number, rows: number): Uint8Array {
  const zones = new Uint8Array(columns * rows);
  const centreX = (columns - 1) / 2;
  const centreY = (rows - 1) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const dx = (column - centreX) / Math.max(centreX, 1);
      const dy = (row - centreY) / Math.max(centreY, 1);
      const distance = Math.sqrt(dx * dx + dy * dy) + (random(rng) - 0.5) * 0.18;
      const roll = random(rng);
      let zone: number;

      if (distance < 0.26) {
        zone = roll < 0.6 ? ZONE_SHOPS : ZONE_OFFICES;
      } else if (distance < 0.56) {
        zone =
          roll < 0.34
            ? ZONE_FLATS
            : roll < 0.62
              ? ZONE_TERRACES
              : roll < 0.8
                ? ZONE_SHOPS
                : roll < 0.9
                  ? ZONE_OFFICES
                  : ZONE_PARK;
      } else if (distance < 1) {
        zone =
          roll < 0.62
            ? ZONE_HOUSES
            : roll < 0.82
              ? ZONE_TERRACES
              : roll < 0.9
                ? ZONE_PARK
                : ZONE_SHOPS;
      } else {
        zone = dy > 0 && roll < 0.55 ? ZONE_INDUSTRY : roll < 0.6 ? ZONE_FARMS : ZONE_HOUSES;
      }

      zones[row * columns + column] = zone;
    }
  }

  zones[Math.round(centreY) * columns + Math.round(centreX)] = ZONE_CIVIC;

  return zones;
}

function ensureZone(rng: Seeded, zones: Uint8Array, zone: number, minimum: number): void {
  let present = zones.filter((value) => value === zone).length;

  while (present < minimum) {
    const index = randomInt(rng, zones.length);

    if (zones[index] === ZONE_HOUSES || zones[index] === ZONE_TERRACES) {
      zones[index] = zone;
      present += 1;
    }
  }
}

function lotRow(
  block: number,
  kind: number,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  gap: number,
): Lot[] {
  const lots: Lot[] = [];
  const lotWidth = (w - gap * (count - 1)) / count;

  for (let index = 0; index < count; index += 1) {
    lots.push({ kind, x: x + index * (lotWidth + gap), y, w: lotWidth, h, block });
  }

  return lots;
}

function blockLots(zone: number, block: number, x: number, y: number): Lot[] {
  const pad = 6;
  const left = x + pad;
  const top = y + pad;
  const width = BLOCK_WIDTH - pad * 2;
  const height = BLOCK_HEIGHT - pad * 2;
  const half = (height - 8) / 2;

  switch (zone) {
    case ZONE_HOUSES:
      return [
        ...lotRow(block, BUILDING_HOUSE, left, top, width, half, 6, 4),
        ...lotRow(block, BUILDING_HOUSE, left, top + half + 8, width, half, 6, 4),
      ];
    case ZONE_TERRACES:
      return [
        ...lotRow(block, BUILDING_TERRACE, left, top, width, half, 3, 3),
        ...lotRow(block, BUILDING_TERRACE, left, top + half + 8, width, half, 3, 3),
      ];
    case ZONE_FLATS:
      return [
        ...lotRow(block, BUILDING_FLATS, left, top, width, half, 3, 7),
        ...lotRow(block, BUILDING_FLATS, left, top + half + 8, width, half, 3, 7),
      ];
    case ZONE_SHOPS:
      return [
        ...lotRow(block, BUILDING_SHOP, left, top, width, half, 4, 4),
        ...lotRow(block, BUILDING_SHOP, left, top + half + 8, width, half, 4, 4),
      ];
    case ZONE_OFFICES:
      return [
        ...lotRow(block, BUILDING_OFFICE, left, top, width, half, 3, 8),
        ...lotRow(block, BUILDING_OFFICE, left, top + half + 8, width, half, 3, 8),
      ];
    case ZONE_INDUSTRY:
      return [
        ...lotRow(block, BUILDING_FACTORY, left, top, width, half, 2, 10),
        ...lotRow(block, BUILDING_FACTORY, left, top + half + 8, width, half, 2, 10),
      ];
    case ZONE_FARMS:
      return lotRow(block, BUILDING_FARM, left, top, width, height, 2, 6);
    case ZONE_PARK:
      return [{ kind: BUILDING_PARK, x: left, y: top, w: width, h: height, block }];
    default:
      return [
        { kind: BUILDING_PLAZA, x: left, y: top, w: width * 0.62, h: height, block },
        { kind: BUILDING_HALL, x: left + width * 0.66, y: top, w: width * 0.34, h: height, block },
      ];
  }
}

export function homesPerBuilding(kind: number, flatUnits: number): number {
  if (kind === BUILDING_HOUSE) {
    return 1;
  }

  if (kind === BUILDING_TERRACE) {
    return 5;
  }

  return kind === BUILDING_FLATS ? flatUnits : 0;
}

export function generateTown(
  rng: Seeded,
  population: number,
  homeSlots: number,
): { town: Town; flatUnits: number } {
  const blocks = Math.min(280, Math.max(70, Math.round(60 + population / 220)));
  const columns = Math.ceil(Math.sqrt(blocks * 1.45));
  const rows = Math.ceil(blocks / columns);
  const riverAfterRow = Math.max(1, Math.floor(rows * 0.62) - 1);
  const zones = layoutZones(rng, columns, rows);
  const schools = Math.max(3, Math.ceil(population / 5000));

  ensureZone(rng, zones, ZONE_FLATS, Math.max(3, Math.round(blocks * 0.08)));
  ensureZone(rng, zones, ZONE_INDUSTRY, Math.max(3, Math.round(blocks * 0.08)));
  ensureZone(rng, zones, ZONE_FARMS, 2);
  ensureZone(rng, zones, ZONE_SHOPS, Math.max(4, Math.round(blocks * 0.1)));
  ensureZone(rng, zones, ZONE_OFFICES, Math.max(2, Math.round(blocks * 0.05)));

  const roadX: number[] = [];
  const roadY: number[] = [];
  const blockX = new Float32Array(zones.length);
  const blockY = new Float32Array(zones.length);
  const lots: Lot[] = [];
  let riverTop = 0;
  let cursorY = 0;

  for (let row = 0; row < rows; row += 1) {
    roadY.push(cursorY + ROAD_WIDTH / 2);
    cursorY += ROAD_WIDTH;

    for (let column = 0; column < columns; column += 1) {
      const x = ROAD_WIDTH + column * (BLOCK_WIDTH + ROAD_WIDTH);
      const index = row * columns + column;

      blockX[index] = x;
      blockY[index] = cursorY;
      lots.push(...blockLots(zones[index], index, x, cursorY));
    }

    cursorY += BLOCK_HEIGHT;

    if (row === riverAfterRow) {
      roadY.push(cursorY + ROAD_WIDTH / 2);
      cursorY += ROAD_WIDTH;
      riverTop = cursorY;
      cursorY += RIVER_HEIGHT;
    }
  }

  roadY.push(cursorY + ROAD_WIDTH / 2);
  cursorY += ROAD_WIDTH;

  for (let column = 0; column <= columns; column += 1) {
    roadX.push(ROAD_WIDTH / 2 + column * (BLOCK_WIDTH + ROAD_WIDTH));
  }

  const width = ROAD_WIDTH + columns * (BLOCK_WIDTH + ROAD_WIDTH);
  const eligibleForCivic = lots.filter((lot) => lot.kind === BUILDING_OFFICE);

  for (let index = 0; index < schools && eligibleForCivic.length > 0; index += 1) {
    eligibleForCivic.splice(randomInt(rng, eligibleForCivic.length), 1)[0].kind = BUILDING_SCHOOL;
  }

  const hospitals = Math.max(1, Math.ceil(population / 15000));

  for (let index = 0; index < hospitals && eligibleForCivic.length > 0; index += 1) {
    eligibleForCivic.splice(randomInt(rng, eligibleForCivic.length), 1)[0].kind = BUILDING_HOSPITAL;
  }

  const count = lots.length;
  const fixedHomes = lots.reduce((sum, lot) => sum + homesPerBuilding(lot.kind, 0), 0);
  const flatBuildings = lots.filter((lot) => lot.kind === BUILDING_FLATS).length;
  const flatUnits = Math.max(8, Math.ceil((homeSlots - fixedHomes) / Math.max(flatBuildings, 1)));
  const town: Town = {
    width,
    height: cursorY,
    columns,
    rows,
    roadX,
    roadY,
    riverTop,
    zones,
    blockX,
    blockY,
    buildingCount: count,
    kind: new Uint8Array(count),
    x: new Float32Array(count),
    y: new Float32Array(count),
    w: new Float32Array(count),
    h: new Float32Array(count),
    block: new Int32Array(count),
    firstHome: new Int32Array(count),
    homeCount: new Int32Array(count),
    builtHomes: new Int32Array(count),
    variant: new Uint8Array(count),
    plaza: 0,
    parks: [],
    shops: [],
    schools: [],
  };
  let nextHome = 0;

  lots.forEach((lot, index) => {
    town.kind[index] = lot.kind;
    town.x[index] = lot.x;
    town.y[index] = lot.y;
    town.w[index] = lot.w;
    town.h[index] = lot.h;
    town.block[index] = lot.block;
    town.variant[index] = randomInt(rng, 256);
    town.firstHome[index] = nextHome;
    town.homeCount[index] = homesPerBuilding(lot.kind, flatUnits);
    nextHome += town.homeCount[index];

    if (lot.kind === BUILDING_PLAZA) {
      town.plaza = index;
    } else if (lot.kind === BUILDING_PARK) {
      town.parks.push(index);
    } else if (lot.kind === BUILDING_SHOP) {
      town.shops.push(index);
    } else if (lot.kind === BUILDING_SCHOOL) {
      town.schools.push(index);
    }
  });

  return { town, flatUnits };
}

export function nearestRoad(roads: readonly number[], value: number): number {
  let best = roads[0];
  let bestDistance = Math.abs(value - best);

  for (let index = 1; index < roads.length; index += 1) {
    const distance = Math.abs(value - roads[index]);

    if (distance < bestDistance) {
      best = roads[index];
      bestDistance = distance;
    }
  }

  return best;
}

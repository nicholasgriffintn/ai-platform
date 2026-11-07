import type { PolisScenario } from "@ngriffin_uk/polychat-schemas";

import { BUILDING_FLATS, BUILDING_HOUSE, BUILDING_TERRACE } from "./constants.js";
import { evictHousehold, removeVacant } from "./housing-market.js";
import { closeFirm, exportFirmsLargestFirst } from "./labour.js";
import { random } from "./random.js";
import { chronicle, type World } from "./world.js";

function destroyHomesNearRiver(world: World, severity: number): number {
  const { town, homes } = world;
  const reach = 60 + severity * 160;
  let destroyed = 0;

  for (let building = 0; building < town.buildingCount; building += 1) {
    const kind = town.kind[building];

    if (kind !== BUILDING_HOUSE && kind !== BUILDING_TERRACE && kind !== BUILDING_FLATS) {
      continue;
    }

    const centre = town.y[building] + town.h[building] / 2;

    if (Math.abs(centre - town.riverTop) > reach || random(world) > 0.35 + severity * 0.5) {
      continue;
    }

    const first = town.firstHome[building];

    for (let home = first; home < first + town.homeCount[building]; home += 1) {
      if (homes.built[home]) {
        evictHousehold(world, home);
        removeVacant(world, home);
        homes.built[home] = 0;
        homes.unbuilt[homes.unbuiltCount] = home;
        homes.unbuiltCount += 1;
        destroyed += 1;
      }
    }

    town.builtHomes[building] = 0;
    world.dirtyBuildings.push(building);
  }

  return destroyed;
}

export function applyScenario(world: World, scenario: PolisScenario): void {
  const { kind, severity, months, title } = scenario;

  chronicle(world, "scenario", title);

  if (kind === "housing_crash") {
    world.housePrice *= 1 - 0.55 * severity;
    world.shocks.push({ kind, severity, monthsLeft: months });

    return;
  }

  if (kind === "factory_closures") {
    const firms = exportFirmsLargestFirst(world);
    const closing = Math.ceil(firms.length * (0.2 + severity * 0.6));

    for (const firm of firms.slice(0, closing)) {
      closeFirm(world, firm);
    }

    return;
  }

  if (kind === "flood") {
    const destroyed = destroyHomesNearRiver(world, severity);

    chronicle(world, "scenario", `The river took ${destroyed.toLocaleString("en-GB")} homes`);

    return;
  }

  world.shocks.push({ kind, severity, monthsLeft: months });
}

export function advanceShocks(world: World): number {
  let confidence = 1;
  let exportFactor = 1;
  let mortality = 1;
  let births = 1;
  let arrivals = 0;

  for (const shock of world.shocks) {
    const { kind, severity } = shock;

    shock.monthsLeft -= 1;

    if (kind === "recession") {
      confidence *= 1 - 0.55 * severity;
      exportFactor *= 1 - 0.5 * severity;
    } else if (kind === "boom") {
      confidence *= 1 + 0.45 * severity;
      exportFactor *= 1 + 0.35 * severity;
    } else if (kind === "epidemic") {
      mortality *= 1 + 14 * severity;
      confidence *= 1 - 0.3 * severity;
    } else if (kind === "baby_boom") {
      births *= 1 + 2 * severity;
    } else if (kind === "immigration_wave") {
      arrivals += (world.population * 0.12 * severity) / Math.max(shock.monthsLeft + 1, 1);
    } else if (kind === "housing_crash") {
      confidence *= 1 - 0.25 * severity;
    }
  }

  world.shocks = world.shocks.filter((shock) => shock.monthsLeft > 0);
  world.confidence = confidence;
  world.exportFactor = exportFactor;
  world.mortalityFactor = mortality;
  world.birthFactor = Math.min(1, 0.45 * births);

  return arrivals;
}

import { POLIS_NO_RENT_CAP as POLIS_RENT_CAP_OFF } from "@ngriffin_uk/polychat-schemas";

import {
  ACCOUNT_BANK,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_LANDLORD,
  ACCOUNT_MARKET,
  ACCOUNT_OUTSIDE,
  MONTHS_PER_YEAR,
  LISTING_RENT,
  LISTING_SALE,
  MONTH_DAYS,
  STATUS_EMPLOYED,
  STATUS_UNEMPLOYED,
  TENURE_HOMELESS,
} from "./constants.js";
import { regimeFrom } from "./decisions.js";
import { addVacant, homePrice, marketRent, rentHome } from "./housing-market.js";
import { settleFirms } from "./labour.js";
import { recordMetrics } from "./metrics.js";
import { allocatePerson } from "./population.js";
import { normal, random, randomInt } from "./random.js";
import { advanceShocks } from "./scenarios.js";
import { noteLife, pay, personAccount, type World } from "./world.js";

const BASE_PRIVATE_BUILD_RATE = 7;
const BUILD_COST_SHARE = 0.62;
const LANDLORD_RESERVE_MONTHS = 24;
const STALE_LISTING_RATE = 0.08;

function countWorkforce(world: World): { workforce: number; unemployed: number } {
  const { people, capacity } = world;
  let employed = 0;
  let unemployed = 0;

  for (let person = 0; person < capacity; person += 1) {
    if (people.alive[person]) {
      if (people.status[person] === STATUS_EMPLOYED) {
        employed += 1;
      } else if (people.status[person] === STATUS_UNEMPLOYED) {
        unemployed += 1;
      }
    }
  }

  return { workforce: employed + unemployed, unemployed };
}

function updatePricesAndWages(world: World, unemploymentRate: number): void {
  const government = world.accounts[ACCOUNT_GOVERNMENT];
  const annualGdp = Math.max(world.counters.wagesPaid * MONTHS_PER_YEAR, 1);
  const debtPressure = Math.max(0, -government / annualGdp - 1) * 0.0012;
  const wageGrowth = Math.min(
    0.012,
    Math.max(-0.004, 0.0016 + (0.055 - unemploymentRate) * 0.014 + debtPressure),
  );

  world.baseWage *= 1 + wageGrowth;
  world.globalWage *= 1 + 0.0016;
  world.inflation = wageGrowth * 0.9 + debtPressure * 0.5;
  world.priceIndex *= 1 + world.inflation;
}

function updateHousingMarket(world: World): void {
  const { homes, parameters } = world;
  const built = Math.max(homes.count - homes.unbuiltCount, 1);
  const vacancy = homes.vacantCount / built;
  const scarcity = Math.min(2.6, Math.max(0.65, 1 + (0.045 - vacancy) * 9));
  const target = world.baseWage * 0.3 * scarcity;

  world.rentIndex += (target - world.rentIndex) * 0.04;

  const capRate = 0.024 + (parameters.interestRatePct / 100) * 0.62;
  const pressure =
    1 + Math.min(0.25, world.counters.failedPurchases / Math.max(world.population, 1));
  const fairPrice = ((world.rentIndex * MONTHS_PER_YEAR) / capRate) * pressure;

  world.housePrice += (fairPrice - world.housePrice) * 0.05;

  const cohort = Math.floor(world.day / MONTH_DAYS) % MONTHS_PER_YEAR;

  for (let home = cohort; home < homes.count; home += MONTHS_PER_YEAR) {
    if (homes.built[home]) {
      const market = marketRent(world, home);
      const cap =
        parameters.rentCapPct >= POLIS_RENT_CAP_OFF
          ? Infinity
          : homes.rent[home] * (1 + parameters.rentCapPct / 100);

      homes.rent[home] = Math.round(Math.min(market, cap));
    }
  }
}

function clearStaleListings(world: World): void {
  const { homes, people } = world;

  for (let index = homes.vacantCount - 1; index >= 0; index -= 1) {
    const home = homes.vacant[index];

    if (homes.listing[home] !== LISTING_SALE || random(world) > STALE_LISTING_RATE) {
      continue;
    }

    const owner = homes.owner[home];
    const capped = homes.rent[home] < marketRent(world, home) * 0.85;

    if (owner === ACCOUNT_LANDLORD) {
      homes.listing[home] = capped ? LISTING_SALE : LISTING_RENT;
      continue;
    }

    const price = homePrice(world, home) * 0.8;

    if (capped || world.accounts[ACCOUNT_LANDLORD] < price) {
      continue;
    }

    pay(world, ACCOUNT_LANDLORD, owner, price);

    if (owner >= world.personBase) {
      const seller = owner - world.personBase;
      const settled = Math.min(people.mortgage[seller], price);

      pay(world, owner, ACCOUNT_BANK, settled);
      people.mortgage[seller] -= Math.round(settled);
      people.owned[seller] = Math.max(0, people.owned[seller] - 1);
    }

    homes.owner[home] = ACCOUNT_LANDLORD;
    homes.listing[home] = LISTING_RENT;
  }
}

function buildHome(world: World, payer: number, publicHome: boolean): boolean {
  const { homes, town } = world;

  if (homes.unbuiltCount === 0) {
    return false;
  }

  const slot = randomInt(world, homes.unbuiltCount);
  const home = homes.unbuilt[slot];

  homes.unbuiltCount -= 1;
  homes.unbuilt[slot] = homes.unbuilt[homes.unbuiltCount];
  pay(world, payer, ACCOUNT_MARKET, homePrice(world, home) * BUILD_COST_SHARE);
  homes.built[home] = 1;
  homes.publicHome[home] = publicHome ? 1 : 0;
  homes.owner[home] = payer;
  homes.rent[home] = Math.round(marketRent(world, home));

  const building = homes.building[home];

  town.builtHomes[building] += 1;

  if (town.builtHomes[building] === 1) {
    world.dirtyBuildings.push(building);
  }

  addVacant(world, home);

  return true;
}

function constructHomes(world: World): void {
  const { parameters, homes } = world;
  const built = Math.max(homes.count - homes.unbuiltCount, 1);
  const vacancy = homes.vacantCount / built;
  const averageRent = world.rentIndex;
  const buildCost = world.housePrice * BUILD_COST_SHARE;
  const yieldOnCost = (averageRent * MONTHS_PER_YEAR) / Math.max(buildCost, 1);
  const rentControl =
    parameters.rentCapPct >= POLIS_RENT_CAP_OFF ? 1 : Math.min(1, parameters.rentCapPct / 8);
  const appetite = Math.min(
    3,
    Math.max(0, yieldOnCost / 0.075) * (vacancy < 0.04 ? 1.6 : vacancy > 0.07 ? 0 : 1),
  );
  const thousands = world.population / 1000;

  world.buildCarry +=
    (BASE_PRIVATE_BUILD_RATE * thousands * appetite * (0.25 + 0.75 * rentControl)) /
    MONTHS_PER_YEAR;
  world.publicBuildCarry +=
    vacancy > 0.1 ? 0 : (parameters.publicHousingRate * thousands) / MONTHS_PER_YEAR;

  while (world.buildCarry >= 1) {
    world.buildCarry -= 1;
    buildHome(world, ACCOUNT_LANDLORD, false);
  }

  while (world.publicBuildCarry >= 1) {
    world.publicBuildCarry -= 1;
    buildHome(world, ACCOUNT_GOVERNMENT, true);
  }
}

function settleInstitutions(world: World): void {
  const { accounts, parameters } = world;
  const debt = Math.max(0, -accounts[ACCOUNT_GOVERNMENT]);

  pay(
    world,
    ACCOUNT_GOVERNMENT,
    ACCOUNT_BANK,
    (debt * parameters.interestRatePct) / 100 / MONTHS_PER_YEAR,
  );

  const governmentReserve = world.baseWage * world.population * 0.5;
  const governmentSurplus = accounts[ACCOUNT_GOVERNMENT] - governmentReserve;

  if (governmentSurplus > 0) {
    pay(world, ACCOUNT_GOVERNMENT, ACCOUNT_MARKET, governmentSurplus * 0.3);
  }

  const landlordReserve = world.rentIndex * world.population * 0.02 * LANDLORD_RESERVE_MONTHS;
  const landlordSurplus = accounts[ACCOUNT_LANDLORD] - landlordReserve;

  if (landlordSurplus > 0) {
    pay(world, ACCOUNT_LANDLORD, ACCOUNT_BANK, landlordSurplus * 0.25);
  }

  const bankReserve = world.baseWage * world.population * 6;
  const bankSurplus = accounts[ACCOUNT_BANK] - bankReserve;

  if (bankSurplus > 0) {
    pay(world, ACCOUNT_BANK, ACCOUNT_MARKET, bankSurplus * 0.03);
  }
}

export function createImmigrant(world: World, minAge = 19, maxAge = 44): number {
  const { people } = world;
  const person = allocatePerson(world);

  if (person === -1) {
    return -1;
  }

  const age = minAge + random(world) * (maxAge - minAge);
  const talent = Math.min(255, Math.max(0, 128 + normal(world) * 48));

  people.birthDay[person] = Math.round(world.day - age * MONTHS_PER_YEAR * MONTH_DAYS);
  people.status[person] = STATUS_UNEMPLOYED;
  people.tenure[person] = TENURE_HOMELESS;
  people.talent[person] = talent;
  people.skill[person] = talent;
  people.thrift[person] = randomInt(world, 256);
  people.aspiration[person] = randomInt(world, 5);
  people.mood[person] = 60;
  people.firstName[person] = randomInt(world, 100);
  people.lastName[person] = randomInt(world, 95);
  pay(
    world,
    ACCOUNT_OUTSIDE,
    personAccount(world, person),
    world.baseWage * (2 + random(world) * 6),
  );
  noteLife(world, person, "arrived");

  return person;
}

function welcomeArrivals(world: World, extra: number): void {
  world.migrationCarry +=
    (world.population * world.parameters.immigrationRate) / 1000 / MONTHS_PER_YEAR + extra;

  while (world.migrationCarry >= 1) {
    world.migrationCarry -= 1;

    const person = createImmigrant(world);

    if (person !== -1) {
      rentHome(world, person);
      world.counters.arrivals += 1;
    }
  }
}

export function endMonth(world: World): void {
  const { workforce, unemployed } = countWorkforce(world);
  const unemploymentRate = unemployed / Math.max(workforce, 1);
  const extraArrivals = advanceShocks(world);

  settleFirms(world, workforce);
  updatePricesAndWages(world, unemploymentRate);
  updateHousingMarket(world);
  clearStaleListings(world);
  constructHomes(world);
  settleInstitutions(world);
  welcomeArrivals(world, extraArrivals);

  const metrics = recordMetrics(world);
  const unemploymentLevel = metrics.unemploymentPct < 5 ? 0 : metrics.unemploymentPct < 11 ? 1 : 2;
  const housingLevel = metrics.rentBurdenPct < 26 ? 0 : metrics.rentBurdenPct < 38 ? 1 : 2;
  const moodLevel = metrics.mood < 45 ? 0 : metrics.mood < 62 ? 1 : 2;

  world.regime = regimeFrom(unemploymentLevel, housingLevel, moodLevel);
}

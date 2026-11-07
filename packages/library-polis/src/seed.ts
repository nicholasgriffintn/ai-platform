import { POLIS_ASPIRATIONS } from "@ngriffin_uk/polychat-schemas";

import {
  ACCOUNT_BANK,
  ACCOUNT_FIRMS,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_LANDLORD,
  ACCOUNT_OUTSIDE,
  ADULT_AGE,
  BUILDING_FACTORY,
  BUILDING_FARM,
  BUILDING_HALL,
  BUILDING_HOSPITAL,
  BUILDING_HOUSE,
  BUILDING_OFFICE,
  BUILDING_SCHOOL,
  BUILDING_SHOP,
  BUILDING_TERRACE,
  LISTING_RENT,
  SCHOOL_START_AGE,
  SECTOR_CONSUMER,
  SECTOR_EXPORT,
  SECTOR_PUBLIC,
  STATUS_CHILD,
  STATUS_RETIRED,
  STATUS_STUDENT,
  STATUS_UNEMPLOYED,
  TENURE_DEPENDANT,
  TENURE_OWNER,
  TENURE_RENTER,
  YEAR_DAYS,
} from "./constants.js";
import { addVacant, homePrice, removeVacant } from "./housing-market.js";
import { createJournal } from "./journal.js";
import { offerFor } from "./labour.js";
import { defaultParameters } from "./laws.js";
import { FIRST_NAMES, LAST_NAMES, placeName } from "./names.js";
import { allocatePerson, linkFirm, linkHome } from "./population.js";
import { normal, random, randomInt } from "./random.js";
import { generateTown, type Town } from "./town.js";
import {
  emptyCounters,
  firmAccount,
  pay,
  personAccount,
  type Firms,
  type Homes,
  type People,
  type World,
  type WorldConfig,
} from "./world.js";

const INITIAL_BASE_WAGE = 2800;
const BUILT_HOME_SHARE_OF_HOUSEHOLDS = 1.1;
const PEOPLE_PER_HOUSEHOLD = 2.5;
const HOME_SLOT_HEADROOM = 1.7;
const CONSUMER_FIRM_SIZE = 9;

function createPeople(capacity: number): People {
  const int32 = () => new Int32Array(capacity).fill(-1);

  return {
    alive: new Uint8Array(capacity),
    status: new Uint8Array(capacity),
    tenure: new Uint8Array(capacity),
    birthDay: new Int32Array(capacity),
    partner: int32(),
    firm: int32(),
    wage: new Int32Array(capacity),
    home: int32(),
    nextInHome: int32(),
    prevInHome: int32(),
    nextInFirm: int32(),
    prevInFirm: int32(),
    school: int32(),
    studyUntil: new Int32Array(capacity),
    mortgage: new Float64Array(capacity),
    owned: new Uint16Array(capacity),
    kids: new Uint8Array(capacity),
    firstChild: int32(),
    nextSibling: int32(),
    parent: int32(),
    talent: new Uint8Array(capacity),
    skill: new Uint8Array(capacity),
    thrift: new Uint8Array(capacity),
    aspiration: new Uint8Array(capacity),
    mood: new Uint8Array(capacity),
    protesting: new Uint8Array(capacity),
    firstName: new Uint8Array(capacity),
    lastName: new Uint8Array(capacity),
  };
}

function homeQuality(world: { rng: number }, kind: number, block: number): number {
  const base = kind === BUILDING_HOUSE ? 1.25 : kind === BUILDING_TERRACE ? 1 : 0.78;

  return base * (0.88 + random(world) * 0.24) * (block % 7 === 0 ? 1.12 : 1);
}

function createHomes(rng: { rng: number }, town: Town): Homes {
  const count = town.homeCount.reduce((sum, value) => sum + value, 0);
  const homes: Homes = {
    count,
    building: new Int32Array(count),
    quality: new Float32Array(count),
    rent: new Int32Array(count),
    owner: new Int32Array(count).fill(ACCOUNT_LANDLORD),
    head: new Int32Array(count).fill(-1),
    built: new Uint8Array(count),
    publicHome: new Uint8Array(count),
    listing: new Uint8Array(count).fill(LISTING_RENT),
    vacantAt: new Int32Array(count).fill(-1),
    vacant: new Int32Array(count),
    vacantCount: 0,
    unbuilt: new Int32Array(count),
    unbuiltCount: 0,
  };

  for (let building = 0; building < town.buildingCount; building += 1) {
    const first = town.firstHome[building];

    for (let home = first; home < first + town.homeCount[building]; home += 1) {
      homes.building[home] = building;
      homes.quality[home] = homeQuality(rng, town.kind[building], town.block[building]);
    }
  }

  return homes;
}

function sectorOf(kind: number): number {
  if (kind === BUILDING_FACTORY || kind === BUILDING_FARM) {
    return SECTOR_EXPORT;
  }

  return kind === BUILDING_SCHOOL || kind === BUILDING_HOSPITAL || kind === BUILDING_HALL
    ? SECTOR_PUBLIC
    : SECTOR_CONSUMER;
}

function createFirms(town: Town): Firms {
  const buildings: number[] = [];

  for (let building = 0; building < town.buildingCount; building += 1) {
    const kind = town.kind[building];

    if (
      kind === BUILDING_SHOP ||
      kind === BUILDING_OFFICE ||
      kind === BUILDING_FACTORY ||
      kind === BUILDING_FARM ||
      kind === BUILDING_SCHOOL ||
      kind === BUILDING_HOSPITAL ||
      kind === BUILDING_HALL
    ) {
      buildings.push(building);
    }
  }

  const count = buildings.length;

  return {
    count,
    building: Int32Array.from(buildings),
    sector: Uint8Array.from(buildings.map((building) => sectorOf(town.kind[building]))),
    active: new Uint8Array(count),
    owner: new Int32Array(count).fill(-1),
    head: new Int32Array(count).fill(-1),
    staff: new Int32Array(count),
    wageBill: new Float64Array(count),
    vacancies: new Int32Array(count),
    capacity: new Int32Array(count),
    revenue: new Float64Array(count),
    distress: new Uint8Array(count),
    idle: new Int32Array(count),
    idleCount: 0,
    hiring: new Int32Array(count * 2),
    hiringCount: 0,
  };
}

function createPerson(world: World, age: number, lastName: number): number {
  const { people } = world;
  const person = allocatePerson(world);
  const talent = Math.min(255, Math.max(0, 128 + normal(world) * 46));

  people.birthDay[person] = Math.round(world.day - age * YEAR_DAYS);
  people.talent[person] = talent;
  people.skill[person] = age >= ADULT_AGE ? talent : 0;
  people.thrift[person] = randomInt(world, 256);
  people.aspiration[person] = randomInt(world, POLIS_ASPIRATIONS.length);
  people.mood[person] = 58 + randomInt(world, 16);
  people.firstName[person] = randomInt(world, FIRST_NAMES.length);
  people.lastName[person] = lastName;

  if (age < SCHOOL_START_AGE) {
    people.status[person] = STATUS_CHILD;
  } else if (age < world.parameters.schoolLeavingAge) {
    people.status[person] = STATUS_STUDENT;
    people.school[person] = world.town.schools[person % world.town.schools.length];
  } else {
    people.status[person] =
      age >= world.parameters.retirementAge ? STATUS_RETIRED : STATUS_UNEMPLOYED;
  }

  return person;
}

function grantSavings(world: World, person: number, age: number): void {
  const months = Math.max(1, (age - ADULT_AGE) * 0.9) * (0.1 + random(world) * 0.9);

  pay(world, ACCOUNT_OUTSIDE, personAccount(world, person), world.baseWage * months);
}

function settleHousehold(world: World, adults: number[], home: number): void {
  const { people, homes } = world;
  const [head] = adults;
  const age = (world.day - people.birthDay[head]) / YEAR_DAYS;
  const owns = random(world) < (age < 32 ? 0.25 : age < 50 ? 0.55 : 0.78);

  removeVacant(world, home);

  for (const adult of adults) {
    people.tenure[adult] = owns ? TENURE_OWNER : TENURE_RENTER;
    linkHome(world, adult, home);
  }

  if (owns) {
    const price = homePrice(world, home);
    const paidOff = Math.min(1, Math.max(0, (age - 28) / 34));

    homes.owner[home] = personAccount(world, head);
    people.owned[head] = 1;
    people.mortgage[head] = Math.round(price * 0.85 * (1 - paidOff));
    pay(world, ACCOUNT_BANK, ACCOUNT_OUTSIDE, people.mortgage[head]);
    pay(world, ACCOUNT_OUTSIDE, ACCOUNT_BANK, people.mortgage[head]);
  }
}

function adultAge(world: World): number {
  return ADULT_AGE + 2 + random(world) ** 1.25 * 66;
}

function populate(world: World, target: number): void {
  const { people, homes } = world;

  while (world.population < target && homes.vacantCount > 0) {
    const home = homes.vacant[randomInt(world, homes.vacantCount)];
    const lastName = randomInt(world, LAST_NAMES.length);
    const roll = random(world);
    const firstAge = adultAge(world);
    const first = createPerson(world, firstAge, lastName);
    const adults = [first];

    grantSavings(world, first, firstAge);

    if (roll > 0.34) {
      const partnerAge = Math.max(ADULT_AGE + 1, firstAge + normal(world) * 3);
      const partner = createPerson(world, partnerAge, lastName);

      people.partner[first] = partner;
      people.partner[partner] = first;
      grantSavings(world, partner, partnerAge);
      adults.push(partner);
    }

    settleHousehold(world, adults, home);

    if (adults.length === 2 && firstAge > 25 && firstAge < 58 && random(world) < 0.68) {
      const children = 1 + randomInt(world, 3);

      for (let index = 0; index < children; index += 1) {
        const age = Math.min(firstAge - 20, random(world) * 19);
        const child = createPerson(world, Math.max(0, age), lastName);

        people.parent[child] = first;
        people.nextSibling[child] = people.firstChild[first];
        people.firstChild[first] = child;
        people.firstChild[adults[1]] = child;
        people.tenure[child] = TENURE_DEPENDANT;
        linkHome(world, child, home);

        if (age < ADULT_AGE) {
          people.kids[first] += 1;
          people.kids[adults[1]] += 1;
        }
      }
    }
  }
}

function openHomes(world: World): void {
  const { homes, town } = world;
  const target = Math.round(
    (world.config.population / PEOPLE_PER_HOUSEHOLD) * BUILT_HOME_SHARE_OF_HOUSEHOLDS,
  );
  const order = Array.from({ length: homes.count }, (_, index) => index);

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = randomInt(world, index + 1);

    [order[index], order[swap]] = [order[swap], order[index]];
  }

  order.forEach((home, rank) => {
    if (rank < target) {
      homes.built[home] = 1;
      homes.rent[home] = Math.round(world.rentIndex * homes.quality[home]);
      town.builtHomes[homes.building[home]] += 1;
      addVacant(world, home);
    } else {
      homes.unbuilt[homes.unbuiltCount] = home;
      homes.unbuiltCount += 1;
    }
  });
}

function staffFirms(world: World): void {
  const { firms, people, capacity } = world;
  const workers: number[] = [];

  for (let person = 0; person < capacity; person += 1) {
    if (people.alive[person] && people.status[person] === STATUS_UNEMPLOYED) {
      workers.push(person);
    }
  }

  const employable = Math.round(workers.length * 0.95);
  const bySector: number[][] = [[], [], []];

  for (let firm = 0; firm < firms.count; firm += 1) {
    bySector[firms.sector[firm]].push(firm);
  }

  const publicStaff = Math.round((employable * world.parameters.publicEmployeesPct) / 100);
  const exportStaff = Math.round(employable * 0.24);
  const consumerStaff = employable - publicStaff - exportStaff;
  const consumerFirms = bySector[SECTOR_CONSUMER];
  const activeConsumers = Math.min(
    consumerFirms.length,
    Math.max(6, Math.ceil(consumerStaff / CONSUMER_FIRM_SIZE)),
  );
  const plans: [number[], number][] = [
    [bySector[SECTOR_PUBLIC], publicStaff],
    [bySector[SECTOR_EXPORT], exportStaff],
    [consumerFirms.slice(0, activeConsumers), consumerStaff],
  ];
  let cursor = 0;

  for (const [list, staff] of plans) {
    const each = Math.ceil(staff / Math.max(list.length, 1));

    list.forEach((firm) => {
      firms.active[firm] = 1;
      firms.capacity[firm] =
        firms.sector[firm] === SECTOR_CONSUMER ? each * 6 : Math.ceil(each * 1.2);

      for (let index = 0; index < each && cursor < employable; index += 1) {
        const person = workers[cursor];

        cursor += 1;
        linkFirm(world, person, firm, offerFor(world, person, firm));
      }

      pay(world, ACCOUNT_OUTSIDE, firmAccount(firm), firms.wageBill[firm] * 3);

      if (firms.sector[firm] !== SECTOR_PUBLIC && random(world) < 0.65 && firms.head[firm] !== -1) {
        firms.owner[firm] = firms.head[firm];
      }
    });
  }

  for (const firm of consumerFirms.slice(activeConsumers)) {
    firms.capacity[firm] = Math.ceil((consumerStaff / activeConsumers) * 6);
    firms.idle[firms.idleCount] = firm;
    firms.idleCount += 1;
  }
}

export function createWorld(config: WorldConfig): World {
  const seeded = { rng: config.seed | 0 };
  const population = Math.max(200, Math.round(config.population));
  const homeSlots = Math.ceil((population / PEOPLE_PER_HOUSEHOLD) * HOME_SLOT_HEADROOM);
  const { town } = generateTown(seeded, population, homeSlots);
  const homes = createHomes(seeded, town);
  const firms = createFirms(town);
  const capacity = Math.ceil(population * 1.9) + 400;
  const personBase = ACCOUNT_FIRMS + firms.count;
  const parameters = defaultParameters();
  const world: World = {
    config: { ...config, population },
    name: config.name?.trim() || placeName(config.seed),
    rng: seeded.rng,
    day: 0,
    capacity,
    personBase,
    accounts: new Float64Array(personBase + capacity),
    people: createPeople(capacity),
    homes,
    firms,
    town,
    free: Int32Array.from({ length: capacity }, (_, index) => capacity - 1 - index),
    freeCount: capacity,
    population: 0,
    parameters,
    baseParameters: { ...parameters },
    laws: [],
    rules: [],
    nextLawId: 1,
    shocks: [],
    baseWage: INITIAL_BASE_WAGE,
    globalWage: INITIAL_BASE_WAGE,
    priceIndex: 1,
    rentIndex: INITIAL_BASE_WAGE * 0.3,
    housePrice: (INITIAL_BASE_WAGE * 0.3 * 12) / (0.024 + 0.04 * 0.62),
    inflation: 0.0015,
    confidence: 1,
    exportFactor: 1,
    mortalityFactor: 1,
    birthFactor: 0.45,
    migrationCarry: 0,
    buildCarry: 0,
    publicBuildCarry: 0,
    regime: 13,
    decisions: {
      epoch: 1,
      answers: new Map(),
      local: new Map(),
      demand: new Map(),
      requested: new Set(),
      modelHits: 0,
      localHits: 0,
    },
    counters: emptyCounters(),
    actionTotals: {},
    history: [],
    chronicle: [],
    log: [],
    eventsApplied: 0,
    recording: true,
    journal: createJournal(),
    followed: -1,
    dirtyBuildings: [],
    milestones: {},
  };

  openHomes(world);
  populate(world, population);
  staffFirms(world);
  pay(world, ACCOUNT_OUTSIDE, ACCOUNT_LANDLORD, world.rentIndex * population * 0.5);
  pay(world, ACCOUNT_OUTSIDE, ACCOUNT_BANK, world.baseWage * population * 6);
  pay(world, ACCOUNT_OUTSIDE, ACCOUNT_GOVERNMENT, world.baseWage * population * 0.5);

  return world;
}

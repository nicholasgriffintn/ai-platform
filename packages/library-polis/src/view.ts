import {
  POLIS_ASPIRATIONS,
  POLIS_PARAMETERS,
  POLIS_PARAMETER_IDS,
  type PolisBucket,
  type PolisParameters,
} from "@ngriffin_uk/polychat-schemas";

import {
  ACCOUNT_GOVERNMENT,
  BUILDING_FACTORY,
  BUILDING_FARM,
  BUILDING_HALL,
  BUILDING_HOSPITAL,
  BUILDING_OFFICE,
  BUILDING_SCHOOL,
  BUILDING_SHOP,
  STATUS_CHILD,
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  TENURE_OWNER,
  TENURE_RENTER,
  YEAR_DAYS,
} from "./constants.js";
import { bucketOf, decodeBucket, pendingDecisionCount } from "./decisions.js";
import { lifeOf, recentEntries, type Journal } from "./journal.js";
import { FIRST_NAMES, LAST_NAMES } from "./names.js";
import {
  ageOf,
  personAccount,
  type ActiveShock,
  type ChronicleEntry,
  type EnactedLaw,
  type MonthlyMetrics,
  type World,
  type WorldEvent,
} from "./world.js";

export interface CitizenView {
  id: number;
  name: string;
  age: number;
  occupation: string;
  home: string;
  wage: number;
  wealth: number;
  mortgage: number;
  mood: number;
  aspiration: string;
  partner: string | null;
  children: number;
  protesting: boolean;
  life: { day: number; hour: number; text: string }[];
}

export interface WorldSnapshot {
  name: string;
  day: number;
  year: number;
  dayOfYear: number;
  latest: MonthlyMetrics | null;
  parameters: PolisParameters;
  baseParameters: PolisParameters;
  laws: EnactedLaw[];
  shocks: ActiveShock[];
  chronicle: ChronicleEntry[];
  actionTotals: Record<string, number>;
  governmentCash: number;
  decisions: {
    epoch: number;
    modelBuckets: number;
    modelShare: number;
    pending: number;
  };
}

const MAX_LIFE_ENTRIES = 12;

const WORKPLACES: Record<number, string> = {
  [BUILDING_SHOP]: "Works in a shop",
  [BUILDING_OFFICE]: "Works in an office",
  [BUILDING_FACTORY]: "Works at a factory",
  [BUILDING_FARM]: "Works on a farm",
  [BUILDING_SCHOOL]: "Teaches at a school",
  [BUILDING_HOSPITAL]: "Works at the hospital",
  [BUILDING_HALL]: "Works at the town hall",
};

export function personName(world: World, person: number): string {
  const { people } = world;

  return `${FIRST_NAMES[people.firstName[person] % FIRST_NAMES.length]} ${LAST_NAMES[people.lastName[person] % LAST_NAMES.length]}`;
}

function occupation(world: World, person: number): string {
  const { people, firms, town } = world;
  const status = people.status[person];

  if (status === STATUS_EMPLOYED) {
    const firm = people.firm[person];
    const label = WORKPLACES[town.kind[firms.building[firm]]] ?? "Employed";

    return firms.owner[firm] === person ? `Runs a business (${label.toLowerCase()})` : label;
  }

  if (status === STATUS_STUDENT) {
    return people.studyUntil[person] > 0 ? "Retraining" : "At school";
  }

  if (status === STATUS_RETIRED) {
    return "Retired";
  }

  return status === STATUS_CHILD ? "Too young for school" : "Out of work";
}

function homeLabel(world: World, person: number): string {
  const { people } = world;

  if (people.home[person] === -1) {
    return "Homeless";
  }

  if (people.owned[person] > 1) {
    return `Landlord with ${people.owned[person]} homes`;
  }

  if (people.tenure[person] === TENURE_OWNER) {
    return "Owns their home";
  }

  return people.tenure[person] === TENURE_RENTER ? "Rents" : "Lives with family";
}

export function describePerson(
  world: World,
  person: number,
  journal: Journal = world.journal,
): CitizenView | null {
  const { people } = world;

  if (person < 0 || person >= world.capacity || !people.alive[person]) {
    return null;
  }

  const partner = people.partner[person];

  return {
    id: person,
    name: personName(world, person),
    age: Math.floor(ageOf(world, person)),
    occupation: occupation(world, person),
    home: homeLabel(world, person),
    wage: people.wage[person],
    wealth: world.accounts[personAccount(world, person)],
    mortgage: people.mortgage[person],
    mood: people.mood[person],
    aspiration: POLIS_ASPIRATIONS[people.aspiration[person]],
    partner: partner === -1 ? null : personName(world, partner),
    children: people.kids[person],
    protesting: people.protesting[person] > 0,
    life: lifeOf(
      journal,
      {
        person,
        firstName: people.firstName[person],
        lastName: people.lastName[person],
        bornOn: people.birthDay[person],
      },
      world.day,
      MAX_LIFE_ENTRIES,
    ),
  };
}

export function snapshotWorld(world: World): WorldSnapshot {
  const { decisions } = world;
  const lookups = decisions.modelHits + decisions.localHits;

  return {
    name: world.name,
    day: world.day,
    year: Math.floor(world.day / YEAR_DAYS) + 1,
    dayOfYear: (world.day % YEAR_DAYS) + 1,
    latest: world.history[world.history.length - 1] ?? null,
    parameters: world.parameters,
    baseParameters: world.baseParameters,
    laws: world.laws,
    shocks: world.shocks,
    chronicle: world.chronicle.slice(-40).reverse(),
    actionTotals: world.actionTotals,
    governmentCash: world.accounts[ACCOUNT_GOVERNMENT],
    decisions: {
      epoch: decisions.epoch,
      modelBuckets: decisions.answers.size,
      modelShare: lookups === 0 ? 0 : decisions.modelHits / lookups,
      pending: pendingDecisionCount(world),
    },
  };
}

export interface PollBucket {
  bucket: PolisBucket;
  people: number;
}

export function largestBuckets(world: World, limit: number): PollBucket[] {
  const { people, capacity } = world;
  const counts = new Map<number, number>();

  for (let person = 0; person < capacity; person += 1) {
    if (people.alive[person] && ageOf(world, person) >= 18) {
      const code = bucketOf(world, person);

      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0] - second[0])
    .slice(0, limit)
    .map(([code, count]) => ({ bucket: decodeBucket(code), people: count }));
}

export function randomCitizen(world: World, salt: number): number {
  const { people, capacity } = world;
  const start = Math.abs(salt) % capacity;

  for (let offset = 0; offset < capacity; offset += 1) {
    const person = (start + offset) % capacity;

    if (people.alive[person] && ageOf(world, person) >= 18) {
      return person;
    }
  }

  return -1;
}

export function follow(world: World, person: number): void {
  world.followed = person;
}

export interface TimelineMark {
  day: number;
  kind: "law" | "scenario" | "parameters";
  label: string;
}

export function timelineMarks(log: readonly WorldEvent[]): TimelineMark[] {
  return log.flatMap((event): TimelineMark[] => {
    if (event.type === "law") {
      return [{ day: event.day, kind: "law", label: event.law.title }];
    }

    if (event.type === "scenario") {
      return [{ day: event.day, kind: "scenario", label: event.scenario.title }];
    }

    if (event.type === "parameters") {
      const labels = POLIS_PARAMETER_IDS.filter((id) => event.values[id] !== undefined).map(
        (id) => POLIS_PARAMETERS[id].label,
      );

      return [{ day: event.day, kind: "parameters", label: `Changed ${labels.join(", ")}` }];
    }

    return [];
  });
}

export interface Moment {
  day: number;
  hour: number;
  text: string;
  name: string;
}

export function recentMoments(
  journal: Journal,
  day: number,
  hour: number,
  limit: number,
): Moment[] {
  return recentEntries(journal, day, hour, limit).map((entry) => ({
    day: entry.day,
    hour: entry.hour,
    text: entry.text,
    name: `${FIRST_NAMES[entry.firstName % FIRST_NAMES.length]} ${LAST_NAMES[entry.lastName % LAST_NAMES.length]}`,
  }));
}

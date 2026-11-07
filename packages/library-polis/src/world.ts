import type {
  PolisLaw,
  PolisParameters,
  PolisRule,
  PolisScenarioKind,
  PolisWorldEvent,
} from "@ngriffin_uk/polychat-schemas";

import { ACCOUNT_FIRMS, MAX_CHRONICLE, YEAR_DAYS } from "./constants.js";
import { appendToJournal, type Journal, type LifeEventKind } from "./journal.js";
import type { Town } from "./town.js";

export interface People {
  alive: Uint8Array;
  status: Uint8Array;
  tenure: Uint8Array;
  birthDay: Int32Array;
  partner: Int32Array;
  firm: Int32Array;
  wage: Int32Array;
  home: Int32Array;
  nextInHome: Int32Array;
  prevInHome: Int32Array;
  nextInFirm: Int32Array;
  prevInFirm: Int32Array;
  school: Int32Array;
  studyUntil: Int32Array;
  mortgage: Float64Array;
  owned: Uint16Array;
  kids: Uint8Array;
  firstChild: Int32Array;
  nextSibling: Int32Array;
  parent: Int32Array;
  talent: Uint8Array;
  skill: Uint8Array;
  thrift: Uint8Array;
  aspiration: Uint8Array;
  mood: Uint8Array;
  protesting: Uint8Array;
  firstName: Uint8Array;
  lastName: Uint8Array;
}

export interface Homes {
  count: number;
  building: Int32Array;
  quality: Float32Array;
  rent: Int32Array;
  owner: Int32Array;
  head: Int32Array;
  built: Uint8Array;
  publicHome: Uint8Array;
  listing: Uint8Array;
  vacantAt: Int32Array;
  vacant: Int32Array;
  vacantCount: number;
  unbuilt: Int32Array;
  unbuiltCount: number;
}

export interface Firms {
  count: number;
  building: Int32Array;
  sector: Uint8Array;
  active: Uint8Array;
  owner: Int32Array;
  head: Int32Array;
  staff: Int32Array;
  wageBill: Float64Array;
  vacancies: Int32Array;
  capacity: Int32Array;
  revenue: Float64Array;
  distress: Uint8Array;
  idle: Int32Array;
  idleCount: number;
  hiring: Int32Array;
  hiringCount: number;
}

export interface EnactedLaw extends PolisLaw {
  id: number;
  day: number;
}

export interface ActiveShock {
  kind: PolisScenarioKind;
  severity: number;
  monthsLeft: number;
}

export interface ChronicleEntry {
  day: number;
  kind: "law" | "scenario" | "milestone" | "people" | "economy";
  text: string;
}

export interface MonthlyMetrics {
  month: number;
  population: number;
  employed: number;
  unemployed: number;
  students: number;
  retired: number;
  children: number;
  homeless: number;
  owners: number;
  renters: number;
  unemploymentPct: number;
  homelessPct: number;
  ownershipPct: number;
  medianWealth: number;
  gini: number;
  mood: number;
  approvalPct: number;
  averageRent: number;
  housePrice: number;
  rentBurdenPct: number;
  gdp: number;
  governmentBalance: number;
  debtToGdp: number;
  inflationPct: number;
  births: number;
  deaths: number;
  arrivals: number;
  departures: number;
  protesters: number;
  firms: number;
  homes: number;
  vacancyPct: number;
}

export interface WorldCounters {
  births: number;
  deaths: number;
  arrivals: number;
  departures: number;
  actions: Record<string, number>;
  failedPurchases: number;
  approvalSum: number;
  approvalCount: number;
  moodSum: number;
  moodCount: number;
  wagesPaid: number;
  profits: number;
  taxTake: number;
  transfers: number;
}

export interface DecisionAnswerRecord {
  inclinations: Float32Array;
  approval: number;
}

export interface DecisionState {
  epoch: number;
  answers: Map<number, DecisionAnswerRecord>;
  local: Map<number, DecisionAnswerRecord>;
  demand: Map<number, number>;
  requested: Set<number>;
  modelHits: number;
  localHits: number;
}

export type WorldEvent = PolisWorldEvent;

export interface WorldConfig {
  id?: string;
  name?: string;
  population: number;
  seed: number;
}

export interface World {
  config: WorldConfig;
  name: string;
  rng: number;
  day: number;
  capacity: number;
  personBase: number;
  accounts: Float64Array;
  people: People;
  homes: Homes;
  firms: Firms;
  town: Town;
  free: Int32Array;
  freeCount: number;
  population: number;
  parameters: PolisParameters;
  baseParameters: PolisParameters;
  laws: EnactedLaw[];
  rules: PolisRule[];
  nextLawId: number;
  shocks: ActiveShock[];
  baseWage: number;
  globalWage: number;
  priceIndex: number;
  rentIndex: number;
  housePrice: number;
  inflation: number;
  confidence: number;
  exportFactor: number;
  mortalityFactor: number;
  birthFactor: number;
  migrationCarry: number;
  buildCarry: number;
  publicBuildCarry: number;
  regime: number;
  decisions: DecisionState;
  counters: WorldCounters;
  actionTotals: Record<string, number>;
  history: MonthlyMetrics[];
  chronicle: ChronicleEntry[];
  log: WorldEvent[];
  eventsApplied: number;
  recording: boolean;
  journal: Journal;
  followed: number;
  dirtyBuildings: number[];
  milestones: Record<string, boolean>;
}

export function emptyCounters(): WorldCounters {
  return {
    births: 0,
    deaths: 0,
    arrivals: 0,
    departures: 0,
    actions: {},
    failedPurchases: 0,
    approvalSum: 0,
    approvalCount: 0,
    moodSum: 0,
    moodCount: 0,
    wagesPaid: 0,
    profits: 0,
    taxTake: 0,
    transfers: 0,
  };
}

export function ageOf(world: World, person: number): number {
  return (world.day - world.people.birthDay[person]) / YEAR_DAYS;
}

export function firmAccount(firm: number): number {
  return ACCOUNT_FIRMS + firm;
}

export function personAccount(world: World, person: number): number {
  return world.personBase + person;
}

export function pay(world: World, from: number, to: number, amount: number): void {
  const whole = Math.round(amount);

  if (whole === 0) {
    return;
  }

  world.accounts[from] -= whole;
  world.accounts[to] += whole;
}

export function chronicle(world: World, kind: ChronicleEntry["kind"], text: string): void {
  world.chronicle.push({ day: world.day, kind, text });

  if (world.chronicle.length > MAX_CHRONICLE) {
    world.chronicle.shift();
  }
}

export function noteLife(world: World, person: number, kind: LifeEventKind): void {
  const { people } = world;

  appendToJournal(world.journal, {
    day: world.day,
    kind,
    person,
    firstName: people.firstName[person],
    lastName: people.lastName[person],
  });
}

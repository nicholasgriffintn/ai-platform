import { lifeMoment, seekWork } from "./actions.js";
import {
  ACCOUNT_BANK,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_MARKET,
  ACCOUNT_OUTSIDE,
  ADULT_AGE,
  SCHOOL_START_AGE,
  STATUS_CHILD,
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  STATUS_UNEMPLOYED,
  TENURE_DEPENDANT,
  TENURE_HOMELESS,
  TENURE_OWNER,
  TENURE_RENTER,
} from "./constants.js";
import { bucketOf, decisionFor } from "./decisions.js";
import { evictHousehold, foreclose, mortgagePayment, rentHome } from "./housing-market.js";
import { matchesCohort } from "./laws.js";
import { removePerson, unlinkFirm } from "./population.js";
import { random, randomInt } from "./random.js";
import { ageOf, firmAccount, noteLife, pay, personAccount, type World } from "./world.js";

const SUBSISTENCE_SHARE = 0.3;
const IMPORT_SHARE = 0.3;
const SAVINGS_RATE_SHARE = 0.35;
const ALLOWANCE_SHARE = 0.3;

function mortalityPerMonth(world: World, age: number): number {
  const yearly = Math.exp(-10.3 + 0.0945 * age) * world.mortalityFactor;

  return Math.min(0.5, yearly / 12) + (age < 1 ? 0.0002 : 0);
}

function nearestSchool(world: World, person: number): number {
  const { town, people, homes } = world;
  const home = people.home[person];
  const { schools } = town;

  if (schools.length === 0) {
    return -1;
  }

  if (home === -1) {
    return schools[person % schools.length];
  }

  const building = homes.building[home];
  let best = schools[0];
  let bestDistance = Infinity;

  for (const school of schools) {
    const distance =
      Math.abs(town.x[school] - town.x[building]) + Math.abs(town.y[school] - town.y[building]);

    if (distance < bestDistance) {
      best = school;
      bestDistance = distance;
    }
  }

  return best;
}

function finishEducation(world: World, person: number, age: number): void {
  const { people } = world;

  if (people.studyUntil[person] === 0) {
    const years = Math.max(0, age - SCHOOL_START_AGE);
    const taught = Math.min(1, years / 15);

    people.skill[person] = Math.min(
      255,
      people.talent[person] * (0.35 + 0.65 * taught) + randomInt(world, 30),
    );
  }

  people.status[person] = STATUS_UNEMPLOYED;
  people.studyUntil[person] = 0;
  people.school[person] = -1;
  noteLife(world, person, "finished_studying");
}

function advanceLifeStage(world: World, person: number, age: number): void {
  const { people } = world;
  const status = people.status[person];

  if (status === STATUS_CHILD && age >= SCHOOL_START_AGE) {
    people.status[person] = STATUS_STUDENT;
    people.school[person] = nearestSchool(world, person);
  } else if (status === STATUS_STUDENT) {
    const studying = people.studyUntil[person] > 0;
    const done = studying
      ? people.studyUntil[person] <= world.day
      : age >= world.parameters.schoolLeavingAge;

    if (done) {
      finishEducation(world, person, age);
    }
  } else if (
    (status === STATUS_EMPLOYED || status === STATUS_UNEMPLOYED) &&
    age >= world.parameters.retirementAge
  ) {
    unlinkFirm(world, person, STATUS_RETIRED);
    people.status[person] = STATUS_RETIRED;
    noteLife(world, person, "retired");
  }

  const parent = people.parent[person];

  if (parent !== -1 && age >= ADULT_AGE && age < ADULT_AGE + 1 / 12 && people.alive[parent]) {
    people.kids[parent] = Math.max(0, people.kids[parent] - 1);

    const partner = people.partner[parent];

    if (partner !== -1) {
      people.kids[partner] = Math.max(0, people.kids[partner] - 1);
    }
  }
}

function receiveWage(world: World, person: number): number {
  const { people, parameters } = world;
  const account = personAccount(world, person);

  if (people.status[person] !== STATUS_EMPLOYED) {
    return 0;
  }

  const gross = people.wage[person];
  const allowance = world.baseWage * ALLOWANCE_SHARE;
  const tax = (Math.max(0, gross - allowance) * parameters.incomeTaxPct) / 100;

  pay(world, firmAccount(people.firm[person]), account, gross);
  pay(world, account, ACCOUNT_GOVERNMENT, tax);
  world.counters.wagesPaid += gross;
  world.counters.taxTake += tax;

  return gross - tax;
}

function payWelfare(world: World, person: number, age: number): number {
  const { people, parameters, priceIndex } = world;
  const status = people.status[person];
  let welfare = 0;

  if (status === STATUS_UNEMPLOYED) {
    welfare += parameters.unemploymentBenefit * priceIndex;
  } else if (status === STATUS_RETIRED) {
    welfare += parameters.statePension * priceIndex;
  }

  if (age >= ADULT_AGE) {
    welfare += parameters.universalIncome * priceIndex;
    welfare += parameters.childBenefit * priceIndex * people.kids[person] * 0.5;
  }

  pay(world, ACCOUNT_GOVERNMENT, personAccount(world, person), welfare);
  world.counters.transfers += welfare;

  return welfare;
}

function applyRules(world: World, person: number): void {
  const account = personAccount(world, person);

  for (const { cohort, effect } of world.rules) {
    if (effect.kind === "payment" && matchesCohort(world, person, cohort)) {
      const amount = effect.amountPerMonth * world.priceIndex;

      pay(world, ACCOUNT_GOVERNMENT, account, amount);
      world.counters.transfers += amount;
    } else if (effect.kind === "levy" && matchesCohort(world, person, cohort)) {
      const levy =
        (Math.max(0, world.accounts[account]) * effect.percentOfWealthPerYear) / 100 / 12;

      pay(world, account, ACCOUNT_GOVERNMENT, levy);
      world.counters.taxTake += levy;
    }
  }
}

function payForHousing(world: World, person: number): number {
  const { people, homes, parameters } = world;
  const account = personAccount(world, person);
  const home = people.home[person];
  const tenure = people.tenure[person];
  let spent = 0;

  if (home !== -1 && tenure === TENURE_RENTER) {
    const partner = people.partner[person];
    const share = partner !== -1 && people.home[partner] === home ? 0.5 : 1;

    spent = homes.rent[home] * share;
    pay(world, account, homes.owner[home], spent);

    if (world.accounts[account] < -homes.rent[home] * 4) {
      evictHousehold(world, home);
      noteLife(world, person, "evicted");
    }
  } else if (people.mortgage[person] > 0) {
    const { interest, principal } = mortgagePayment(world, people.mortgage[person]);

    spent = interest + principal;
    pay(world, account, ACCOUNT_BANK, spent);
    people.mortgage[person] = Math.max(0, people.mortgage[person] - Math.round(principal));

    if (world.accounts[account] < -spent * 6 && tenure === TENURE_OWNER) {
      foreclose(world, person);
      noteLife(world, person, "repossessed");
    }
  }

  if (tenure === TENURE_OWNER && home !== -1 && homes.owner[home] === account) {
    const propertyTax =
      (world.housePrice * homes.quality[home] * parameters.propertyTaxPct) / 100 / 12;

    pay(world, account, ACCOUNT_GOVERNMENT, propertyTax);
    world.counters.taxTake += propertyTax;
    spent += propertyTax;
  }

  return spent;
}

function spendMoney(world: World, person: number, income: number): void {
  const { people, parameters } = world;
  const account = personAccount(world, person);
  const balance = world.accounts[account];

  if (balance <= 0) {
    return;
  }

  const subsistence = world.baseWage * SUBSISTENCE_SHARE * (1 + 0.28 * people.kids[person]);
  const needs = Math.min(balance, subsistence);
  const spare = Math.max(0, balance - needs - subsistence * 3);
  const thrift = people.thrift[person] / 255;
  const fromIncome = Math.max(0, income - needs) * (1 - SAVINGS_RATE_SHARE * thrift);
  const fromSavings = spare * (0.012 + 0.03 * (1 - thrift));
  const spend = Math.min(
    balance,
    needs + (Math.min(fromIncome, spare) + fromSavings) * world.confidence,
  );
  const salesTax = (spend * parameters.salesTaxPct) / (100 + parameters.salesTaxPct);
  const net = spend - salesTax;
  const imports = net * IMPORT_SHARE;

  pay(world, account, ACCOUNT_GOVERNMENT, salesTax);
  pay(world, account, ACCOUNT_OUTSIDE, imports);
  pay(world, account, ACCOUNT_MARKET, net - imports);
  world.counters.taxTake += salesTax;
}

function earnInterest(world: World, person: number): void {
  const account = personAccount(world, person);
  const balance = world.accounts[account];

  if (balance > 0) {
    pay(
      world,
      ACCOUNT_BANK,
      account,
      (balance * world.parameters.interestRatePct * 0.35) / 100 / 12,
    );
  }
}

function updateMood(
  world: World,
  person: number,
  income: number,
  housing: number,
  approval: number,
): void {
  const { people } = world;
  const status = people.status[person];
  const homeless = people.home[person] === -1;
  const burden = income > 0 ? housing / income : housing > 0 ? 1 : 0;
  const cash = world.accounts[personAccount(world, person)];
  let target = 50 - (world.parameters.incomeTaxPct - 22) * 0.25;

  target += status === STATUS_UNEMPLOYED ? -18 : status === STATUS_RETIRED ? 6 : 4;
  target += homeless ? -34 : people.tenure[person] === TENURE_OWNER ? 8 : 0;
  target += burden > 0.5 ? -14 : burden > 0.35 ? -6 : 2;
  target += cash < 0 ? -12 : cash > world.baseWage * 12 ? 8 : 0;
  target += people.partner[person] !== -1 ? 5 : 0;
  target += (approval - 0.5) * 12;

  people.mood[person] = Math.max(
    0,
    Math.min(100, people.mood[person] + (target - people.mood[person]) * 0.2),
  );
}

export function settlePerson(world: World, person: number): void {
  const { people, counters } = world;
  const age = ageOf(world, person);

  if (random(world) < mortalityPerMonth(world, age)) {
    noteLife(world, person, "died");
    removePerson(world, person, true);
    counters.deaths += 1;

    return;
  }

  advanceLifeStage(world, person, age);

  if (people.protesting[person] > 0) {
    people.protesting[person] -= 1;
  }

  if (age < 16) {
    return;
  }

  const net = receiveWage(world, person) + payWelfare(world, person, age);

  if (world.rules.length > 0) {
    applyRules(world, person);
  }

  const housing = payForHousing(world, person);

  if (!people.alive[person]) {
    return;
  }

  earnInterest(world, person);
  spendMoney(world, person, Math.max(0, net - housing));

  if (age >= ADULT_AGE) {
    settleAdult(world, person, net, housing);
  }
}

function settleAdult(world: World, person: number, net: number, housing: number): void {
  const { people, homes, counters } = world;
  const code = bucketOf(world, person);
  const decision = decisionFor(world, code);

  counters.approvalSum += decision.approval;
  counters.approvalCount += 1;
  updateMood(world, person, net, housing, decision.approval);
  counters.moodSum += people.mood[person];
  counters.moodCount += 1;

  if (people.status[person] === STATUS_UNEMPLOYED) {
    seekWork(world, person);
  }

  if (people.tenure[person] === TENURE_HOMELESS) {
    rentHome(world, person);
  } else if (
    people.tenure[person] === TENURE_DEPENDANT &&
    people.status[person] === STATUS_EMPLOYED &&
    homes.vacantCount > 0 &&
    random(world) < 0.06
  ) {
    rentHome(world, person);
  }

  lifeMoment(world, person, decision);
}

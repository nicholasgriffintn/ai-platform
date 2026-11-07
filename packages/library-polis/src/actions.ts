import { POLIS_ACTIONS, POLIS_ASPIRATIONS, type PolisAction } from "@ngriffin_uk/polychat-schemas";

import {
  ADULT_AGE,
  STATUS_CHILD,
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  STATUS_UNEMPLOYED,
  TENURE_DEPENDANT,
  TENURE_HOMELESS,
  TENURE_OWNER,
  TENURE_RENTER,
  YEAR_DAYS,
} from "./constants.js";
import { buyHome } from "./housing-market.js";
import { hireIfPossible, offerFor } from "./labour.js";
import { actionMultiplier } from "./laws.js";
import {
  allocatePerson,
  linkFirm,
  linkHome,
  removePerson,
  unlinkFirm,
  unlinkHome,
} from "./population.js";
import { random, randomInt } from "./random.js";
import {
  ageOf,
  firmAccount,
  noteLife,
  pay,
  personAccount,
  type DecisionAnswerRecord,
  type World,
} from "./world.js";

const MONTHLY_BASE_RATE: Record<PolisAction, number> = {
  buy_home: 0.022,
  buy_to_let: 0.006,
  change_job: 0.012,
  start_business: 0.0016,
  have_child: 0.011,
  couple_up: 0.03,
  retrain: 0.003,
  retire_early: 0.012,
  move_away: 0.0007,
  protest: 0.006,
};

const FAMILY_ASPIRATION = POLIS_ASPIRATIONS.indexOf("family");
const MAX_INCLINATION_MULTIPLIER = 4;

export function hazardFor(action: PolisAction, inclination: number): number {
  const scaled = (inclination / 0.5) ** 2;

  return MONTHLY_BASE_RATE[action] * Math.min(MAX_INCLINATION_MULTIPLIER, scaled);
}

function cash(world: World, person: number): number {
  return world.accounts[personAccount(world, person)];
}

function buyOwnHome(world: World, person: number): boolean {
  const tenure = world.people.tenure[person];

  if (tenure === TENURE_OWNER || world.people.wage[person] === 0) {
    return false;
  }

  const bought = buyHome(world, person, true);

  if (bought) {
    noteLife(world, person, "bought_home");
  }

  return bought;
}

function buyRental(world: World, person: number): boolean {
  if (
    world.people.tenure[person] !== TENURE_OWNER ||
    cash(world, person) < world.housePrice * 0.5
  ) {
    return false;
  }

  const bought = buyHome(world, person, false);

  if (bought) {
    noteLife(world, person, "bought_rental");
  }

  return bought;
}

function changeJob(world: World, person: number): boolean {
  const { people, firms } = world;

  if (people.status[person] !== STATUS_EMPLOYED || firms.hiringCount === 0) {
    return false;
  }

  const firm = firms.hiring[randomInt(world, firms.hiringCount)];
  const offer = offerFor(world, person, firm);

  if (
    offer <= people.wage[person] * 1.04 ||
    firms.vacancies[firm] <= 0 ||
    firm === people.firm[person]
  ) {
    return false;
  }

  unlinkFirm(world, person);
  linkFirm(world, person, firm, offer);
  firms.vacancies[firm] -= 1;
  noteLife(world, person, "better_job");

  return true;
}

function startBusiness(world: World, person: number): boolean {
  const { firms, people } = world;
  const capital = world.baseWage * 10;

  if (firms.idleCount === 0 || cash(world, person) < capital || ageOf(world, person) > 62) {
    return false;
  }

  if (people.status[person] !== STATUS_EMPLOYED && people.status[person] !== STATUS_UNEMPLOYED) {
    return false;
  }

  const slot = randomInt(world, firms.idleCount);
  const firm = firms.idle[slot];

  firms.idleCount -= 1;
  firms.idle[slot] = firms.idle[firms.idleCount];
  firms.active[firm] = 1;
  firms.owner[firm] = person;
  firms.distress[firm] = 0;
  firms.vacancies[firm] = 2;
  pay(world, personAccount(world, person), firmAccount(firm), capital);
  unlinkFirm(world, person);
  linkFirm(world, person, firm, Math.round(offerFor(world, person, firm) * 1.1));

  noteLife(world, person, "opened_business");

  return true;
}

function haveChild(world: World, person: number): boolean {
  const { people } = world;
  const partner = people.partner[person];

  if (partner === -1 || people.home[person] === -1 || people.kids[person] >= 5) {
    return false;
  }

  const age = ageOf(world, person);

  if (age > 45 || ageOf(world, partner) > 48 || random(world) > world.birthFactor) {
    return false;
  }

  const child = allocatePerson(world);

  if (child === -1) {
    return false;
  }

  people.birthDay[child] = world.day;
  people.status[child] = STATUS_CHILD;
  people.parent[child] = person;
  people.lastName[child] = people.lastName[person];
  people.firstName[child] = randomInt(world, 100);
  people.talent[child] = Math.min(
    255,
    Math.max(0, (people.talent[person] + people.talent[partner]) / 2 + (random(world) - 0.5) * 120),
  );
  people.skill[child] = 0;
  people.thrift[child] = randomInt(world, 256);
  people.aspiration[child] = randomInt(world, POLIS_ASPIRATIONS.length);
  people.mood[child] = 70;
  noteLife(world, child, "born");
  people.nextSibling[child] = people.firstChild[person];
  people.firstChild[person] = child;
  people.firstChild[partner] = child;
  people.kids[person] += 1;
  people.kids[partner] += 1;
  linkHome(world, child, people.home[person]);
  world.counters.births += 1;
  noteLife(world, person, "had_child");
  noteLife(world, partner, "had_child");

  return true;
}

function moveInWith(world: World, mover: number, host: number): void {
  const { people, homes } = world;
  const home = people.home[host];
  const from = people.home[mover];

  if (home === -1) {
    return;
  }

  if (from !== -1) {
    const residents: number[] = [];

    for (let resident = homes.head[from]; resident !== -1; resident = people.nextInHome[resident]) {
      if (resident === mover || people.parent[resident] === mover) {
        residents.push(resident);
      }
    }

    for (const resident of residents) {
      unlinkHome(world, resident);
      linkHome(world, resident, home);
    }
  } else {
    linkHome(world, mover, home);
  }

  people.tenure[mover] = people.tenure[host];
}

function coupleUp(world: World, person: number): boolean {
  const { people, capacity } = world;
  const age = ageOf(world, person);

  if (people.partner[person] !== -1 || age < ADULT_AGE || age > 70) {
    return false;
  }

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidate = randomInt(world, capacity);

    if (!people.alive[candidate] || candidate === person || people.partner[candidate] !== -1) {
      continue;
    }

    const candidateAge = ageOf(world, candidate);

    if (candidateAge < ADULT_AGE || Math.abs(candidateAge - age) > 12) {
      continue;
    }

    people.partner[person] = candidate;
    people.partner[candidate] = person;

    const personHosts =
      people.tenure[person] === TENURE_OWNER ||
      (people.tenure[person] === TENURE_RENTER && people.tenure[candidate] !== TENURE_OWNER);

    if (personHosts) {
      moveInWith(world, candidate, person);
    } else {
      moveInWith(world, person, candidate);
    }

    noteLife(world, person, "settled_down");
    noteLife(world, candidate, "settled_down");

    return true;
  }

  return false;
}

function retrain(world: World, person: number): boolean {
  const { people } = world;

  if (ageOf(world, person) > 52 || cash(world, person) < world.baseWage * 2) {
    return false;
  }

  if (people.status[person] !== STATUS_EMPLOYED && people.status[person] !== STATUS_UNEMPLOYED) {
    return false;
  }

  unlinkFirm(world, person, STATUS_STUDENT);
  people.status[person] = STATUS_STUDENT;
  people.studyUntil[person] = world.day + YEAR_DAYS + randomInt(world, YEAR_DAYS);
  people.skill[person] = Math.min(255, people.skill[person] + 28 + randomInt(world, 30));
  noteLife(world, person, "went_to_study");

  return true;
}

function retireEarly(world: World, person: number): boolean {
  const { people } = world;

  if (
    people.status[person] !== STATUS_EMPLOYED ||
    ageOf(world, person) < 55 ||
    cash(world, person) < world.baseWage * 60
  ) {
    return false;
  }

  unlinkFirm(world, person, STATUS_RETIRED);
  noteLife(world, person, "retired_early");

  return true;
}

function moveAway(world: World, person: number): boolean {
  const { homes, people } = world;
  const home = people.home[person];
  const leavers = [person];

  if (ageOf(world, person) < ADULT_AGE) {
    return false;
  }

  if (home !== -1 && people.tenure[person] !== TENURE_DEPENDANT) {
    for (let resident = homes.head[home]; resident !== -1; resident = people.nextInHome[resident]) {
      if (resident !== person) {
        leavers.push(resident);
      }
    }
  }

  for (const leaver of leavers) {
    noteLife(world, leaver, "left_town");
    removePerson(world, leaver, false);
    world.counters.departures += 1;
  }

  return true;
}

function protest(world: World, person: number): boolean {
  const { people } = world;

  if (people.protesting[person] > 0) {
    return false;
  }

  people.protesting[person] = 2 + randomInt(world, 2);
  noteLife(world, person, "protested");

  return true;
}

const PERFORM: Record<PolisAction, (world: World, person: number) => boolean> = {
  buy_home: buyOwnHome,
  buy_to_let: buyRental,
  change_job: changeJob,
  start_business: startBusiness,
  have_child: haveChild,
  couple_up: coupleUp,
  retrain,
  retire_early: retireEarly,
  move_away: moveAway,
  protest,
};

export function lifeMoment(world: World, person: number, decision: DecisionAnswerRecord): void {
  const { people, counters } = world;

  for (let index = 0; index < POLIS_ACTIONS.length; index += 1) {
    if (!people.alive[person]) {
      return;
    }

    const action = POLIS_ACTIONS[index];
    let hazard = hazardFor(action, decision.inclinations[index]);

    if (action === "have_child" && people.aspiration[person] === FAMILY_ASPIRATION) {
      hazard *= 1.3;
    }

    if (action === "buy_home" && people.tenure[person] === TENURE_HOMELESS) {
      hazard *= 0.2;
    }

    if (random(world) >= hazard) {
      continue;
    }

    if (world.rules.length > 0 && random(world) >= actionMultiplier(world, person, action)) {
      continue;
    }

    if (PERFORM[action](world, person)) {
      counters.actions[action] = (counters.actions[action] ?? 0) + 1;
    }
  }
}

export function seekWork(world: World, person: number): void {
  if (hireIfPossible(world, person)) {
    noteLife(world, person, "found_job");
  }
}

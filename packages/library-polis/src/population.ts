import {
  ACCOUNT_BANK,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_OUTSIDE,
  ADULT_AGE,
  STATUS_EMPLOYED,
  STATUS_UNEMPLOYED,
  TENURE_DEPENDANT,
  TENURE_HOMELESS,
} from "./constants.js";
import { addVacant } from "./housing-market.js";
import { ageOf, pay, personAccount, type World } from "./world.js";

const MAX_CHILD_LINKS = 12;

export function allocatePerson(world: World): number {
  if (world.freeCount === 0) {
    return -1;
  }

  world.freeCount -= 1;

  const person = world.free[world.freeCount];
  const { people } = world;

  people.alive[person] = 1;
  people.partner[person] = -1;
  people.firm[person] = -1;
  people.home[person] = -1;
  people.nextInHome[person] = -1;
  people.prevInHome[person] = -1;
  people.nextInFirm[person] = -1;
  people.prevInFirm[person] = -1;
  people.firstChild[person] = -1;
  people.nextSibling[person] = -1;
  people.parent[person] = -1;
  people.school[person] = -1;
  people.studyUntil[person] = 0;
  people.mortgage[person] = 0;
  people.owned[person] = 0;
  people.kids[person] = 0;
  people.wage[person] = 0;
  people.protesting[person] = 0;
  people.tenure[person] = TENURE_DEPENDANT;
  world.population += 1;

  return person;
}

export function linkHome(world: World, person: number, home: number): void {
  const { people, homes } = world;
  const head = homes.head[home];

  people.home[person] = home;
  people.prevInHome[person] = -1;
  people.nextInHome[person] = head;

  if (head !== -1) {
    people.prevInHome[head] = person;
  }

  homes.head[home] = person;
}

export function unlinkHome(world: World, person: number): void {
  const { people, homes } = world;
  const home = people.home[person];

  if (home === -1) {
    return;
  }

  const previous = people.prevInHome[person];
  const next = people.nextInHome[person];

  if (previous === -1) {
    homes.head[home] = next;
  } else {
    people.nextInHome[previous] = next;
  }

  if (next !== -1) {
    people.prevInHome[next] = previous;
  }

  people.home[person] = -1;
  people.nextInHome[person] = -1;
  people.prevInHome[person] = -1;

  if (homes.head[home] === -1) {
    addVacant(world, home);
  }
}

export function linkFirm(world: World, person: number, firm: number, wage: number): void {
  const { people, firms } = world;
  const head = firms.head[firm];

  people.firm[person] = firm;
  people.wage[person] = wage;
  people.status[person] = STATUS_EMPLOYED;
  people.prevInFirm[person] = -1;
  people.nextInFirm[person] = head;

  if (head !== -1) {
    people.prevInFirm[head] = person;
  }

  firms.head[firm] = person;
  firms.staff[firm] += 1;
  firms.wageBill[firm] += wage;
}

export function unlinkFirm(world: World, person: number, nextStatus = STATUS_UNEMPLOYED): void {
  const { people, firms } = world;
  const firm = people.firm[person];

  if (firm === -1) {
    return;
  }

  const previous = people.prevInFirm[person];
  const next = people.nextInFirm[person];

  if (previous === -1) {
    firms.head[firm] = next;
  } else {
    people.nextInFirm[previous] = next;
  }

  if (next !== -1) {
    people.prevInFirm[next] = previous;
  }

  firms.staff[firm] -= 1;
  firms.wageBill[firm] -= people.wage[person];
  people.firm[person] = -1;
  people.wage[person] = 0;
  people.nextInFirm[person] = -1;
  people.prevInFirm[person] = -1;
  people.status[person] = nextStatus;
}

export function childrenOf(world: World, person: number): number[] {
  const { people } = world;
  const children: number[] = [];
  let child = people.firstChild[person];

  for (let step = 0; step < MAX_CHILD_LINKS && child !== -1; step += 1) {
    if (people.alive[child] && !children.includes(child)) {
      children.push(child);
    }

    child = people.nextSibling[child];
  }

  return children;
}

function findHeir(world: World, person: number): number {
  const partner = world.people.partner[person];

  return partner !== -1 ? partner : (childrenOf(world, person)[0] ?? -1);
}

function transferOwnership(world: World, person: number, heir: number): void {
  const { homes, people } = world;
  const account = personAccount(world, person);
  const target = heir === -1 ? ACCOUNT_BANK : personAccount(world, heir);

  for (let home = 0; home < homes.count && people.owned[person] > 0; home += 1) {
    if (homes.owner[home] === account) {
      homes.owner[home] = target;
      people.owned[person] -= 1;

      if (heir !== -1) {
        people.owned[heir] += 1;
      }
    }
  }
}

function promoteResident(world: World, home: number, tenure: number): void {
  const { homes, people } = world;

  for (let person = homes.head[home]; person !== -1; person = people.nextInHome[person]) {
    if (people.tenure[person] !== TENURE_DEPENDANT) {
      return;
    }
  }

  for (let person = homes.head[home]; person !== -1; person = people.nextInHome[person]) {
    if (ageOf(world, person) >= ADULT_AGE) {
      people.tenure[person] = tenure;

      return;
    }
  }
}

export function removePerson(world: World, person: number, inheritance: boolean): void {
  const { people } = world;
  const partner = people.partner[person];
  const parent = people.parent[person];
  const home = people.home[person];
  const tenure = people.tenure[person];
  const account = personAccount(world, person);
  const heir = inheritance ? findHeir(world, person) : -1;

  if (ageOf(world, person) < ADULT_AGE && parent !== -1 && people.alive[parent]) {
    people.kids[parent] = Math.max(0, people.kids[parent] - 1);
  }

  unlinkFirm(world, person);
  transferOwnership(world, person, heir);

  if (heir !== -1) {
    people.mortgage[heir] += people.mortgage[person];
    pay(world, account, personAccount(world, heir), world.accounts[account]);
  } else {
    pay(
      world,
      account,
      inheritance ? ACCOUNT_GOVERNMENT : ACCOUNT_OUTSIDE,
      world.accounts[account],
    );
  }

  if (partner !== -1) {
    people.partner[partner] = -1;
  }

  unlinkHome(world, person);

  if (home !== -1 && tenure !== TENURE_DEPENDANT && tenure !== TENURE_HOMELESS) {
    promoteResident(world, home, tenure);
  }

  people.alive[person] = 0;
  people.partner[person] = -1;
  people.mortgage[person] = 0;
  world.free[world.freeCount] = person;
  world.freeCount += 1;
  world.population -= 1;

  if (person === world.followed) {
    world.followed = -1;
  }
}

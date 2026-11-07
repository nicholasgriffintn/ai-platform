import {
  ACCOUNT_BANK,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_LANDLORD,
  ADULT_AGE,
  LISTING_RENT,
  LISTING_SALE,
  TENURE_DEPENDANT,
  TENURE_HOMELESS,
  TENURE_OWNER,
  TENURE_RENTER,
} from "./constants.js";
import { childrenOf, linkHome, unlinkHome } from "./population.js";
import { random, randomInt } from "./random.js";
import { ageOf, pay, personAccount, type World } from "./world.js";

const PUBLIC_RENT_SHARE = 0.6;
const DEPOSIT_SHARE = 0.1;
const MORTGAGE_MONTHS = 300;
const SEARCH_ATTEMPTS = 10;
const MAX_MORTGAGE_INCOME_SHARE = 0.45;

export function marketRent(world: World, home: number): number {
  const rent = world.rentIndex * world.homes.quality[home];

  return world.homes.publicHome[home] ? rent * PUBLIC_RENT_SHARE : rent;
}

export function homePrice(world: World, home: number): number {
  return world.housePrice * world.homes.quality[home];
}

export function mortgagePayment(
  world: World,
  balance: number,
): {
  interest: number;
  principal: number;
} {
  return {
    interest: (balance * world.parameters.interestRatePct) / 100 / 12,
    principal: balance / MORTGAGE_MONTHS,
  };
}

function chooseListing(world: World, home: number): number {
  const { homes } = world;
  const owner = homes.owner[home];

  if (homes.publicHome[home] || owner === ACCOUNT_GOVERNMENT) {
    return LISTING_RENT;
  }

  if (owner === ACCOUNT_BANK) {
    return LISTING_SALE;
  }

  if (owner !== ACCOUNT_LANDLORD) {
    const person = owner - world.personBase;

    return world.people.home[person] !== -1 && world.people.owned[person] > 1
      ? LISTING_RENT
      : LISTING_SALE;
  }

  const rentRatio = homes.rent[home] / Math.max(marketRent(world, home), 1);

  return random(world) < (rentRatio < 0.85 ? 0.75 : 0.3) ? LISTING_SALE : LISTING_RENT;
}

export function addVacant(world: World, home: number): void {
  const { homes } = world;

  if (homes.vacantAt[home] !== -1 || !homes.built[home]) {
    return;
  }

  homes.vacantAt[home] = homes.vacantCount;
  homes.vacant[homes.vacantCount] = home;
  homes.vacantCount += 1;
  homes.listing[home] = chooseListing(world, home);
}

export function removeVacant(world: World, home: number): void {
  const { homes } = world;
  const position = homes.vacantAt[home];

  if (position === -1) {
    return;
  }

  homes.vacantCount -= 1;

  const moved = homes.vacant[homes.vacantCount];

  homes.vacant[position] = moved;
  homes.vacantAt[moved] = position;
  homes.vacantAt[home] = -1;
}

function relocate(world: World, person: number, home: number): void {
  unlinkHome(world, person);
  linkHome(world, person, home);
}

function moveHousehold(world: World, person: number, home: number, tenure: number): void {
  const { people } = world;
  const current = people.home[person];
  const partner = people.partner[person];
  const leavingParents = people.tenure[person] === TENURE_DEPENDANT;

  if (current !== -1 && !leavingParents) {
    const movers: number[] = [];

    for (
      let resident = world.homes.head[current];
      resident !== -1;
      resident = people.nextInHome[resident]
    ) {
      movers.push(resident);
    }

    for (const mover of movers) {
      relocate(world, mover, home);
    }
  } else {
    relocate(world, person, home);
  }

  if (partner !== -1 && people.home[partner] !== home) {
    relocate(world, partner, home);
  }

  for (const child of childrenOf(world, person)) {
    if (people.home[child] === -1 && ageOf(world, child) < ADULT_AGE) {
      linkHome(world, child, home);
    }
  }

  people.tenure[person] = tenure;

  if (partner !== -1) {
    people.tenure[partner] = tenure;
  }
}

function pickListed(world: World, listing: number, accepts: (home: number) => boolean): number {
  const { homes } = world;

  if (homes.vacantCount === 0) {
    return -1;
  }

  for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt += 1) {
    const home = homes.vacant[randomInt(world, homes.vacantCount)];

    if (homes.listing[home] === listing && accepts(home)) {
      return home;
    }
  }

  return -1;
}

export function householdIncome(world: World, person: number): number {
  const { people } = world;
  const partner = people.partner[person];

  return people.wage[person] + (partner === -1 ? 0 : people.wage[partner]);
}

export function rentHome(world: World, person: number): boolean {
  const income = Math.max(householdIncome(world, person), world.parameters.statePension);
  const home = pickListed(
    world,
    LISTING_RENT,
    (candidate) => world.homes.rent[candidate] < income * 0.7,
  );

  if (home === -1) {
    return false;
  }

  removeVacant(world, home);
  moveHousehold(world, person, home, TENURE_RENTER);

  return true;
}

function completeSale(world: World, buyer: number, home: number, price: number): void {
  const { homes, people } = world;
  const seller = homes.owner[home];
  const deposit = Math.round(price * DEPOSIT_SHARE);
  const loan = Math.round(price) - deposit;
  const buyerAccount = personAccount(world, buyer);

  pay(world, buyerAccount, seller, deposit);
  pay(world, ACCOUNT_BANK, seller, loan);
  people.mortgage[buyer] += loan;

  if (seller >= world.personBase) {
    const person = seller - world.personBase;
    const settled = Math.min(people.mortgage[person], price);

    pay(world, seller, ACCOUNT_BANK, settled);
    people.mortgage[person] -= Math.round(settled);
    people.owned[person] = Math.max(0, people.owned[person] - 1);
  }

  homes.owner[home] = buyerAccount;
  people.owned[buyer] += 1;
}

export function buyHome(world: World, buyer: number, occupy: boolean): boolean {
  const { people } = world;
  const cash = world.accounts[personAccount(world, buyer)];
  const income = householdIncome(world, buyer);
  const rate = world.parameters.interestRatePct / 100 / 12 + 1 / MORTGAGE_MONTHS;
  const incomeLimit = occupy
    ? (income * MAX_MORTGAGE_INCOME_SHARE) / rate / (1 - DEPOSIT_SHARE)
    : Infinity;
  const budget = Math.min(cash / DEPOSIT_SHARE, incomeLimit);
  const home = pickListed(
    world,
    LISTING_SALE,
    (candidate) =>
      world.homes.owner[candidate] !== personAccount(world, buyer) &&
      homePrice(world, candidate) <= budget,
  );

  if (home === -1) {
    world.counters.failedPurchases += 1;

    return false;
  }

  completeSale(world, buyer, home, homePrice(world, home));

  if (occupy) {
    removeVacant(world, home);
    moveHousehold(world, buyer, home, TENURE_OWNER);
  } else {
    world.homes.listing[home] = LISTING_RENT;
  }

  return people.owned[buyer] > 0;
}

export function evictHousehold(world: World, home: number): void {
  const { homes, people } = world;
  const residents: number[] = [];

  for (let person = homes.head[home]; person !== -1; person = people.nextInHome[person]) {
    residents.push(person);
  }

  for (const person of residents) {
    unlinkHome(world, person);

    if (people.tenure[person] !== TENURE_DEPENDANT || ageOf(world, person) >= ADULT_AGE) {
      people.tenure[person] = TENURE_HOMELESS;
    }
  }
}

export function foreclose(world: World, person: number): void {
  const { homes, people } = world;
  const home = people.home[person];
  const partner = people.partner[person];
  const account = personAccount(world, person);

  if (home === -1) {
    return;
  }

  if (homes.owner[home] === account) {
    homes.owner[home] = ACCOUNT_BANK;
    people.owned[person] = Math.max(0, people.owned[person] - 1);
    people.mortgage[person] = 0;
  } else if (partner !== -1 && homes.owner[home] === personAccount(world, partner)) {
    homes.owner[home] = ACCOUNT_BANK;
    people.owned[partner] = Math.max(0, people.owned[partner] - 1);
    people.mortgage[partner] = 0;
    people.mortgage[person] = 0;
  }

  evictHousehold(world, home);
}

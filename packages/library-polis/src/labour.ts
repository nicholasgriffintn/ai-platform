import {
  ACCOUNT_BANK,
  ACCOUNT_GOVERNMENT,
  ACCOUNT_MARKET,
  ACCOUNT_OUTSIDE,
  SECTOR_CONSUMER,
  SECTOR_EXPORT,
  SECTOR_PUBLIC,
  STATUS_UNEMPLOYED,
} from "./constants.js";
import { linkFirm, unlinkFirm } from "./population.js";
import { randomInt } from "./random.js";
import { chronicle, firmAccount, noteLife, pay, personAccount, type World } from "./world.js";

const HIRING_ATTEMPTS = 5;
const EXPORT_REVENUE_PER_WAGE = 1.075;
const CONSUMER_LABOUR_SHARE = 0.56;
const DIVIDEND_SHARE = 0.5;
const OWNER_SHARE = 0.3;
const CASH_BUFFER_MONTHS = 3;

export function minimumWage(world: World): number {
  return world.parameters.minimumWage * world.priceIndex;
}

export function productivity(world: World, person: number): number {
  return world.baseWage * (0.62 + (0.85 * world.people.skill[person]) / 255);
}

export function offerFor(world: World, person: number, firm: number): number {
  const sectorPremium = world.firms.sector[firm] === SECTOR_PUBLIC ? 0.98 : 1;

  return Math.round(Math.max(productivity(world, person) * sectorPremium, minimumWage(world)));
}

export function hireIfPossible(world: World, person: number): boolean {
  const { firms } = world;

  for (let attempt = 0; attempt < HIRING_ATTEMPTS && firms.hiringCount > 0; attempt += 1) {
    const slot = randomInt(world, firms.hiringCount);
    const firm = firms.hiring[slot];

    if (firms.vacancies[firm] <= 0) {
      firms.hiringCount -= 1;
      firms.hiring[slot] = firms.hiring[firms.hiringCount];
      continue;
    }

    const worthIt =
      firms.sector[firm] === SECTOR_PUBLIC ||
      productivity(world, person) * 1.08 >= minimumWage(world);

    if (!worthIt) {
      continue;
    }

    linkFirm(world, person, firm, offerFor(world, person, firm));
    firms.vacancies[firm] -= 1;

    return true;
  }

  return false;
}

export function layOff(world: World, firm: number, count: number): void {
  const { firms } = world;

  for (let index = 0; index < count; index += 1) {
    const person = firms.head[firm];

    if (person === -1) {
      return;
    }

    if (world.firms.owner[firm] === person && world.people.nextInFirm[person] === -1) {
      return;
    }

    const target = world.firms.owner[firm] === person ? world.people.nextInFirm[person] : person;

    unlinkFirm(world, target, STATUS_UNEMPLOYED);
    noteLife(world, target, "laid_off");
  }
}

export function closeFirm(world: World, firm: number): void {
  const { firms } = world;
  const staff = firms.staff[firm];

  while (firms.head[firm] !== -1) {
    const person = firms.head[firm];

    unlinkFirm(world, person, STATUS_UNEMPLOYED);
    noteLife(world, person, "firm_closed");
  }

  firms.active[firm] = 0;
  firms.owner[firm] = -1;
  firms.vacancies[firm] = 0;
  firms.idle[firms.idleCount] = firm;
  firms.idleCount += 1;
  pay(world, firmAccount(firm), ACCOUNT_OUTSIDE, world.accounts[firmAccount(firm)]);

  if (staff >= Math.max(40, world.population / 300)) {
    chronicle(world, "economy", `A big employer closed, putting ${staff} out of work`);
  }
}

function settleProfit(world: World, firm: number, revenue: number): void {
  const { firms } = world;
  const account = firmAccount(firm);
  const profit = revenue - firms.wageBill[firm];

  world.counters.profits += Math.max(0, profit);

  if (profit > 0) {
    const tax = (profit * world.parameters.corporateTaxPct) / 100;

    pay(world, account, ACCOUNT_GOVERNMENT, tax);
    world.counters.taxTake += tax;
  }

  const surplus = world.accounts[account] - firms.wageBill[firm] * CASH_BUFFER_MONTHS;

  if (surplus > 0) {
    const owner = firms.owner[firm];

    const dividend = surplus * DIVIDEND_SHARE;
    const toOwner = owner === -1 ? 0 : dividend * OWNER_SHARE;

    pay(world, account, ACCOUNT_BANK, dividend - toOwner);

    if (owner !== -1) {
      pay(world, account, personAccount(world, owner), toOwner);
    }
  }
}

function adjustStaff(world: World, firm: number, target: number): void {
  const { firms } = world;
  const staff = firms.staff[firm];
  const capped = Math.min(Math.round(target), firms.capacity[firm]);

  if (capped > staff) {
    firms.vacancies[firm] = Math.max(1, Math.ceil((capped - staff) * 0.5));
    firms.hiring[firms.hiringCount] = firm;
    firms.hiringCount += 1;
  } else {
    firms.vacancies[firm] = 0;

    if (capped < staff * 0.92) {
      layOff(world, firm, Math.ceil((staff - capped) * 0.34));
    }
  }
}

function checkDistress(world: World, firm: number): boolean {
  const { firms } = world;
  const cash = world.accounts[firmAccount(firm)];

  if (cash < 0) {
    firms.distress[firm] += 1;
  } else {
    firms.distress[firm] = Math.max(0, firms.distress[firm] - 1);
  }

  if (firms.distress[firm] >= 3) {
    closeFirm(world, firm);

    return true;
  }

  return false;
}

export function publicStaffTarget(world: World, firmCount: number, workforce: number): number {
  return (workforce * world.parameters.publicEmployeesPct) / 100 / Math.max(firmCount, 1);
}

export function settleFirms(world: World, workforce: number): void {
  const { firms } = world;
  const market = world.accounts[ACCOUNT_MARKET];
  let consumerWeight = 0;
  let publicFirms = 0;

  firms.hiringCount = 0;

  for (let firm = 0; firm < firms.count; firm += 1) {
    if (!firms.active[firm]) {
      continue;
    }

    if (firms.sector[firm] === SECTOR_CONSUMER) {
      consumerWeight += firms.staff[firm] + 1;
    } else if (firms.sector[firm] === SECTOR_PUBLIC) {
      publicFirms += 1;
    }
  }

  const publicTarget = publicStaffTarget(world, publicFirms, workforce);

  for (let firm = 0; firm < firms.count; firm += 1) {
    if (!firms.active[firm]) {
      continue;
    }

    const account = firmAccount(firm);
    const sector = firms.sector[firm];
    const averageWage =
      firms.staff[firm] > 0 ? firms.wageBill[firm] / firms.staff[firm] : world.baseWage;

    if (sector === SECTOR_PUBLIC) {
      pay(world, ACCOUNT_GOVERNMENT, account, firms.wageBill[firm]);
      adjustStaff(world, firm, publicTarget);
      continue;
    }

    let revenue: number;
    let target: number;

    if (sector === SECTOR_CONSUMER) {
      revenue = (market * (firms.staff[firm] + 1)) / Math.max(consumerWeight, 1);
      pay(world, ACCOUNT_MARKET, account, revenue);
      target = (revenue * CONSUMER_LABOUR_SHARE) / Math.max(averageWage, 1);
    } else {
      const perHead = world.globalWage * EXPORT_REVENUE_PER_WAGE * world.exportFactor;

      revenue = firms.staff[firm] * perHead;
      pay(world, ACCOUNT_OUTSIDE, account, revenue);
      target = perHead > averageWage * 1.04 ? firms.staff[firm] + 3 : firms.staff[firm] * 0.88;
    }

    firms.revenue[firm] = revenue;
    settleProfit(world, firm, revenue);

    if (!checkDistress(world, firm)) {
      adjustStaff(world, firm, target);
    }
  }
}

export function exportFirmsLargestFirst(world: World): number[] {
  const { firms } = world;
  const list: number[] = [];

  for (let firm = 0; firm < firms.count; firm += 1) {
    if (firms.active[firm] && firms.sector[firm] === SECTOR_EXPORT) {
      list.push(firm);
    }
  }

  return list.sort((first, second) => firms.staff[second] - firms.staff[first] || first - second);
}

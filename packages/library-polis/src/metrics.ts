import {
  ACCOUNT_GOVERNMENT,
  ADULT_AGE,
  MONTH_DAYS,
  MONTHS_PER_YEAR,
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  STATUS_UNEMPLOYED,
  TENURE_OWNER,
  TENURE_RENTER,
} from "./constants.js";
import {
  ageOf,
  chronicle,
  emptyCounters,
  personAccount,
  type MonthlyMetrics,
  type World,
} from "./world.js";

const SAMPLE_LIMIT = 4000;

function distribution(world: World): { median: number; gini: number } {
  const { people, capacity } = world;
  const stride = Math.max(1, Math.floor(capacity / SAMPLE_LIMIT));
  const sample: number[] = [];

  for (let person = 0; person < capacity; person += stride) {
    if (people.alive[person] && ageOf(world, person) >= ADULT_AGE) {
      sample.push(Math.max(0, world.accounts[personAccount(world, person)]));
    }
  }

  sample.sort((first, second) => first - second);

  const count = sample.length;

  if (count === 0) {
    return { median: 0, gini: 0 };
  }

  let weighted = 0;
  let total = 0;

  sample.forEach((value, index) => {
    weighted += (index + 1) * value;
    total += value;
  });

  return {
    median: sample[Math.floor(count / 2)],
    gini: total === 0 ? 0 : (2 * weighted) / (count * total) - (count + 1) / count,
  };
}

function checkMilestones(world: World, metrics: MonthlyMetrics): void {
  const announce = (key: string, active: boolean, text: string) => {
    if (active && !world.milestones[key]) {
      world.milestones[key] = true;
      chronicle(world, "milestone", text);
    } else if (!active) {
      world.milestones[key] = false;
    }
  };

  announce("unemployment", metrics.unemploymentPct > 14, "Unemployment passed 14%");
  announce("homeless", metrics.homelessPct > 3, "Homelessness passed 3% of the town");
  announce(
    "protests",
    metrics.protesters > world.population * 0.02,
    "Crowds filled the square in protest",
  );
  announce("approval", metrics.approvalPct < 40, "The council's approval fell below 40%");
  announce("inflation", metrics.inflationPct > 8, "Prices are rising faster than 8% a year");
  announce(
    "exodus",
    metrics.departures > metrics.arrivals * 3 + 20,
    "People are leaving faster than they arrive",
  );
}

export function recordMetrics(world: World): MonthlyMetrics {
  const { people, homes, firms, counters, capacity } = world;
  let employed = 0;
  let unemployed = 0;
  let students = 0;
  let retired = 0;
  let children = 0;
  let homeless = 0;
  let owners = 0;
  let renters = 0;
  let protesters = 0;
  let rentTotal = 0;
  let rentCount = 0;
  let wageTotal = 0;

  for (let person = 0; person < capacity; person += 1) {
    if (!people.alive[person]) {
      continue;
    }

    const status = people.status[person];

    if (status === STATUS_EMPLOYED) {
      employed += 1;
      wageTotal += people.wage[person];
    } else if (status === STATUS_UNEMPLOYED) {
      unemployed += 1;
    } else if (status === STATUS_RETIRED) {
      retired += 1;
    } else if (status === STATUS_STUDENT) {
      students += 1;
    } else {
      children += 1;
    }

    const home = people.home[person];

    if (home === -1) {
      homeless += 1;
    } else if (people.tenure[person] === TENURE_OWNER) {
      owners += 1;
    } else if (people.tenure[person] === TENURE_RENTER) {
      renters += 1;
      rentTotal += homes.rent[home];
      rentCount += 1;
    }

    if (people.protesting[person] > 0) {
      protesters += 1;
    }
  }

  let activeFirms = 0;

  for (let firm = 0; firm < firms.count; firm += 1) {
    activeFirms += firms.active[firm];
  }

  const { median, gini } = distribution(world);
  const previous = world.history[world.history.length - 1];
  const gdp = (counters.wagesPaid + counters.profits) * MONTHS_PER_YEAR;
  const averageRent = rentCount > 0 ? rentTotal / rentCount : world.rentIndex;
  const averageWage = employed > 0 ? wageTotal / employed : world.baseWage;
  const built = homes.count - homes.unbuiltCount;
  const metrics: MonthlyMetrics = {
    month: Math.floor(world.day / MONTH_DAYS),
    population: world.population,
    employed,
    unemployed,
    students,
    retired,
    children,
    homeless,
    owners,
    renters,
    unemploymentPct: (unemployed / Math.max(employed + unemployed, 1)) * 100,
    homelessPct: (homeless / Math.max(world.population, 1)) * 100,
    ownershipPct: (owners / Math.max(owners + renters, 1)) * 100,
    medianWealth: median,
    gini,
    mood: counters.moodCount > 0 ? counters.moodSum / counters.moodCount : (previous?.mood ?? 60),
    approvalPct:
      counters.approvalCount > 0
        ? (counters.approvalSum / counters.approvalCount) * 100
        : (previous?.approvalPct ?? 55),
    averageRent,
    housePrice: world.housePrice,
    rentBurdenPct: (averageRent / Math.max(averageWage, 1)) * 100,
    gdp,
    governmentBalance: (counters.taxTake - counters.transfers) * MONTHS_PER_YEAR,
    debtToGdp: Math.max(0, -world.accounts[ACCOUNT_GOVERNMENT]) / Math.max(gdp, 1),
    inflationPct: ((1 + world.inflation) ** MONTHS_PER_YEAR - 1) * 100,
    births: counters.births,
    deaths: counters.deaths,
    arrivals: counters.arrivals,
    departures: counters.departures,
    protesters,
    firms: activeFirms,
    homes: built,
    vacancyPct: (homes.vacantCount / Math.max(built, 1)) * 100,
  };

  world.history.push(metrics);
  checkMilestones(world, metrics);

  for (const [action, count] of Object.entries(counters.actions)) {
    world.actionTotals[action] = (world.actionTotals[action] ?? 0) + count;
  }

  world.counters = emptyCounters();

  return metrics;
}

import {
  POLIS_ACTIONS,
  POLIS_AGE_BANDS,
  POLIS_ASPIRATIONS,
  POLIS_EMPLOYMENT,
  POLIS_LEVELS,
  POLIS_TENURE,
  POLIS_WEALTH,
  type PolisAction,
  type PolisBucket,
  type PolisBucketAnswer,
} from "@ngriffin_uk/polychat-schemas";

import {
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  TENURE_HOMELESS,
  TENURE_OWNER,
} from "./constants.js";
import { ageOf, personAccount, type DecisionAnswerRecord, type World } from "./world.js";

const AGE_COUNT = POLIS_AGE_BANDS.length;
const WEALTH_COUNT = POLIS_WEALTH.length;
const EMPLOYMENT_COUNT = POLIS_EMPLOYMENT.length;
const TENURE_COUNT = POLIS_TENURE.length;
const ASPIRATION_COUNT = POLIS_ASPIRATIONS.length;
const LEVEL_COUNT = POLIS_LEVELS.length;
const REGIME_COUNT = LEVEL_COUNT ** 3;

export const ACTION_INDEX = Object.fromEntries(
  POLIS_ACTIONS.map((action, index) => [action, index]),
) as Record<PolisAction, number>;

export function ageBand(age: number): number {
  if (age < 25) {
    return 0;
  }

  if (age < 35) {
    return 1;
  }

  if (age < 50) {
    return 2;
  }

  return age < 65 ? 3 : 4;
}

export function wealthBand(world: World, person: number): number {
  const cash = world.accounts[personAccount(world, person)] - world.people.mortgage[person] * 0.25;

  if (cash < 0) {
    return 0;
  }

  if (cash < world.baseWage * 4) {
    return 1;
  }

  return cash < world.baseWage * 40 ? 2 : 3;
}

export function employmentBand(status: number): number {
  if (status === STATUS_EMPLOYED) {
    return 0;
  }

  if (status === STATUS_RETIRED) {
    return 2;
  }

  return status === STATUS_STUDENT ? 3 : 1;
}

export function tenureBand(world: World, person: number): number {
  const { people } = world;
  const tenure = people.tenure[person];

  if (tenure === TENURE_HOMELESS || people.home[person] === -1) {
    return 3;
  }

  if (people.owned[person] > 1) {
    return 2;
  }

  return tenure === TENURE_OWNER ? 0 : 1;
}

export function bucketOf(world: World, person: number): number {
  const { people } = world;
  let code = ageBand(ageOf(world, person));

  code = code * WEALTH_COUNT + wealthBand(world, person);
  code = code * EMPLOYMENT_COUNT + employmentBand(people.status[person]);
  code = code * TENURE_COUNT + tenureBand(world, person);
  code = code * ASPIRATION_COUNT + people.aspiration[person];

  return code * REGIME_COUNT + world.regime;
}

export function regimeFrom(unemployment: number, housingCost: number, mood: number): number {
  return (unemployment * LEVEL_COUNT + housingCost) * LEVEL_COUNT + mood;
}

export function decodeBucket(key: number): PolisBucket {
  let rest = key;
  const regime = rest % REGIME_COUNT;

  rest = Math.floor(rest / REGIME_COUNT);

  const aspiration = rest % ASPIRATION_COUNT;

  rest = Math.floor(rest / ASPIRATION_COUNT);

  const tenure = rest % TENURE_COUNT;

  rest = Math.floor(rest / TENURE_COUNT);

  const employment = rest % EMPLOYMENT_COUNT;

  rest = Math.floor(rest / EMPLOYMENT_COUNT);

  const wealth = rest % WEALTH_COUNT;
  const age = Math.floor(rest / WEALTH_COUNT) % AGE_COUNT;

  return {
    key,
    age: POLIS_AGE_BANDS[age],
    wealth: POLIS_WEALTH[wealth],
    employment: POLIS_EMPLOYMENT[employment],
    tenure: POLIS_TENURE[tenure],
    aspiration: POLIS_ASPIRATIONS[aspiration],
    unemployment: POLIS_LEVELS[Math.floor(regime / (LEVEL_COUNT * LEVEL_COUNT))],
    housingCost: POLIS_LEVELS[Math.floor(regime / LEVEL_COUNT) % LEVEL_COUNT],
    mood: POLIS_LEVELS[regime % LEVEL_COUNT],
  };
}

function clampProbability(value: number): number {
  return Math.min(0.97, Math.max(0.03, value));
}

export function localInclinations(bucket: PolisBucket): Record<PolisAction, number> {
  const rich = bucket.wealth === "rich";
  const poor = bucket.wealth === "poor" || bucket.wealth === "in_debt";
  const hardTimes =
    (bucket.unemployment === "high" ? 0.12 : 0) + (bucket.mood === "low" ? 0.12 : 0);
  const pricey = bucket.housingCost === "high";
  const young = bucket.age === "young" || bucket.age === "starting_out";
  const homeless = bucket.tenure === "homeless";

  return {
    buy_home: clampProbability(0.5 + (rich ? 0.2 : 0) + (poor ? -0.2 : 0) + (pricey ? -0.12 : 0)),
    buy_to_let: clampProbability(
      0.4 + (bucket.aspiration === "wealth" ? 0.25 : 0) + (pricey ? 0.08 : 0),
    ),
    change_job: clampProbability(0.5 + (bucket.aspiration === "career" ? 0.2 : 0) - hardTimes),
    start_business: clampProbability(
      0.42 +
        (bucket.aspiration === "wealth" ? 0.2 : 0) +
        (bucket.aspiration === "career" ? 0.08 : 0) -
        hardTimes,
    ),
    have_child: clampProbability(
      0.5 +
        (bucket.aspiration === "family" ? 0.25 : 0) +
        (poor ? -0.12 : 0) +
        (homeless ? -0.3 : 0) -
        hardTimes / 2,
    ),
    couple_up: clampProbability(
      0.5 + (bucket.aspiration === "family" ? 0.2 : 0) + (young ? 0.1 : -0.1),
    ),
    retrain: clampProbability(
      0.4 +
        (bucket.employment === "unemployed" ? 0.22 : 0) +
        (bucket.aspiration === "career" ? 0.15 : 0),
    ),
    retire_early: clampProbability(
      0.4 + (rich ? 0.25 : 0) + (bucket.aspiration === "comfort" ? 0.15 : 0),
    ),
    move_away: clampProbability(
      0.32 + hardTimes + (pricey ? 0.12 : 0) + (homeless ? 0.25 : 0) + (young ? 0.06 : 0),
    ),
    protest: clampProbability(
      0.24 +
        hardTimes * 1.5 +
        (poor ? 0.12 : 0) +
        (homeless ? 0.3 : 0) +
        (bucket.aspiration === "community" ? 0.1 : 0),
    ),
  };
}

export function localApproval(bucket: PolisBucket): number {
  const score =
    0.5 +
    (bucket.mood === "high" ? 0.14 : bucket.mood === "low" ? -0.18 : 0) +
    (bucket.unemployment === "high" ? -0.12 : bucket.unemployment === "low" ? 0.05 : 0) +
    (bucket.housingCost === "high" ? -0.08 : 0) +
    (bucket.employment === "unemployed" ? -0.08 : 0) +
    (bucket.tenure === "homeless" ? -0.2 : 0);

  return clampProbability(score);
}

function toRecord(
  inclinations: Record<PolisAction, number>,
  approval: number,
): DecisionAnswerRecord {
  return {
    inclinations: Float32Array.from(POLIS_ACTIONS.map((action) => inclinations[action])),
    approval,
  };
}

export function decisionFor(world: World, code: number): DecisionAnswerRecord {
  const { decisions } = world;
  const answer = decisions.answers.get(code);

  if (answer) {
    decisions.modelHits += 1;

    return answer;
  }

  decisions.localHits += 1;

  if (!decisions.requested.has(code)) {
    decisions.demand.set(code, (decisions.demand.get(code) ?? 0) + 1);
  }

  let local = decisions.local.get(code);

  if (!local) {
    const bucket = decodeBucket(code);

    local = toRecord(localInclinations(bucket), localApproval(bucket));
    decisions.local.set(code, local);
  }

  return local;
}

export function takeDecisionBuckets(world: World, limit: number): PolisBucket[] {
  const { decisions } = world;
  const ranked = [...decisions.demand.entries()].sort(
    (first, second) => second[1] - first[1] || first[0] - second[0],
  );

  return ranked.slice(0, limit).map(([code]) => {
    decisions.demand.delete(code);
    decisions.requested.add(code);

    return decodeBucket(code);
  });
}

export function pendingDecisionCount(world: World): number {
  return world.decisions.demand.size;
}

export function answersToEventPayload(answers: readonly PolisBucketAnswer[]) {
  return answers.map(({ key, inclinations, approval }) => ({
    key,
    approval,
    inclinations: POLIS_ACTIONS.map((action) => inclinations[action] ?? 0.5),
  }));
}

export function storeDecisionAnswers(
  world: World,
  epoch: number,
  answers: readonly { key: number; inclinations: readonly number[]; approval: number }[],
): void {
  if (epoch !== world.decisions.epoch) {
    return;
  }

  for (const { key, inclinations, approval } of answers) {
    world.decisions.answers.set(key, {
      inclinations: Float32Array.from(inclinations),
      approval,
    });
  }
}

export function releaseDecisionRequests(world: World, keys: readonly number[]): void {
  for (const key of keys) {
    world.decisions.requested.delete(key);
  }
}

export function resetDecisions(world: World): void {
  const { decisions } = world;

  decisions.epoch += 1;
  decisions.answers.clear();
  decisions.demand.clear();
  decisions.requested.clear();
  decisions.local.clear();
}

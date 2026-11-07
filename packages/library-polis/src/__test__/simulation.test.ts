import { polisLawSchema, type PolisLaw, type PolisScenario } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  YEAR_DAYS,
  advanceTo,
  continueFrom,
  createKeyframe,
  createWorld,
  dispatch,
  forkWorld,
  moneySupply,
  replayWorld,
  stepDay,
  takeDecisionBuckets,
  worldHash,
  type World,
} from "../index.js";

const anyone = { minAge: null, maxAge: null, employment: null, tenure: null, wealth: null };

function runDays(world: World, days: number): void {
  for (let day = 0; day < days; day += 1) {
    stepDay(world);
  }
}

function law(rules: PolisLaw["rules"], changes: PolisLaw["changes"] = []): PolisLaw {
  return { title: "Test Act", summary: "A test", changes, rules };
}

function scenario(kind: PolisScenario["kind"], severity = 0.7): PolisScenario {
  return { kind, title: kind, summary: kind, severity, months: 12 };
}

describe("polis simulation", () => {
  it("keeps every unit of money accounted for through laws and shocks", () => {
    const world = createWorld({ population: 1500, seed: 11 });

    runDays(world, YEAR_DAYS);
    dispatch(world, { type: "scenario", day: world.day, scenario: scenario("flood") });
    dispatch(world, { type: "scenario", day: world.day, scenario: scenario("factory_closures") });
    dispatch(world, {
      type: "law",
      day: world.day,
      law: law(
        [
          {
            cohort: { ...anyone, wealth: "rich" },
            effect: { kind: "levy", percentOfWealthPerYear: 5 },
          },
          { cohort: { ...anyone, minAge: 65 }, effect: { kind: "payment", amountPerMonth: 300 } },
        ],
        [{ parameter: "universalIncome", value: 500 }],
      ),
    });
    runDays(world, YEAR_DAYS * 6);

    expect(moneySupply(world)).toBe(0);
    expect(world.population).toBeGreaterThan(0);
  });

  it("replays to the same world from its seed and event log", () => {
    const world = createWorld({ population: 800, seed: 5 });

    runDays(world, 200);
    dispatch(world, {
      type: "parameters",
      day: world.day,
      values: { incomeTaxPct: 35, rentCapPct: 3 },
    });
    runDays(world, 200);
    dispatch(world, { type: "scenario", day: world.day, scenario: scenario("recession") });
    dispatch(world, {
      type: "answers",
      day: world.day,
      epoch: world.decisions.epoch,
      answers: takeDecisionBuckets(world, 5).map(({ key }) => ({
        key,
        approval: 0.2,
        inclinations: Array.from({ length: 10 }, () => 0.9),
      })),
    });
    runDays(world, 300);

    expect(worldHash(replayWorld(world.config, world.log, world.day))).toBe(worldHash(world));
  });

  it("only separates a fork from its parent once something changes", () => {
    const world = createWorld({ population: 800, seed: 9 });

    runDays(world, YEAR_DAYS);

    const untouched = forkWorld(world);
    const changed = forkWorld(world);

    dispatch(changed, { type: "parameters", day: changed.day, values: { minimumWage: 4500 } });
    runDays(world, YEAR_DAYS);
    runDays(untouched, YEAR_DAYS);
    runDays(changed, YEAR_DAYS);

    expect(worldHash(untouched)).toBe(worldHash(world));
    expect(worldHash(changed)).not.toBe(worldHash(world));
  });

  it("stops banned behaviour for the cohort a law names", () => {
    const world = createWorld({ population: 1500, seed: 3 });

    runDays(world, YEAR_DAYS);
    dispatch(world, {
      type: "law",
      day: world.day,
      law: law([{ cohort: anyone, effect: { kind: "ban", action: "have_child" } }]),
    });

    const before = world.actionTotals.have_child ?? 0;

    runDays(world, YEAR_DAYS * 2);

    expect(world.actionTotals.have_child ?? 0).toBe(before);
  });

  it("raises unemployment when the minimum wage is set far above productivity", () => {
    const control = createWorld({ population: 2000, seed: 21 });

    runDays(control, YEAR_DAYS * 2);

    const raised = forkWorld(control);

    dispatch(raised, { type: "parameters", day: raised.day, values: { minimumWage: 5000 } });
    runDays(control, YEAR_DAYS * 4);
    runDays(raised, YEAR_DAYS * 4);

    expect(raised.history.at(-1)?.unemploymentPct).toBeGreaterThan(
      (control.history.at(-1)?.unemploymentPct ?? 0) + 5,
    );
  });

  it("lets decision model answers drive what people do", () => {
    const calm = createWorld({ population: 1500, seed: 8 });

    runDays(calm, 120);

    const angry = forkWorld(calm);
    const answerAll = (world: World, protest: number) => {
      const buckets = takeDecisionBuckets(world, 1000);

      dispatch(world, {
        type: "answers",
        day: world.day,
        epoch: world.decisions.epoch,
        answers: buckets.map(({ key }) => ({
          key,
          approval: 0.5,
          inclinations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, protest],
        })),
      });
    };

    for (let month = 0; month < 12; month += 1) {
      answerAll(calm, 0.03);
      answerAll(angry, 0.97);
      runDays(calm, 30);
      runDays(angry, 30);
    }

    expect(angry.actionTotals.protest).toBeGreaterThan((calm.actionTotals.protest ?? 0) * 5);
  });

  it("ignores answers asked under laws that have since changed", () => {
    const world = createWorld({ population: 600, seed: 2 });

    runDays(world, 60);

    const [bucket] = takeDecisionBuckets(world, 1);
    const staleEpoch = world.decisions.epoch;

    dispatch(world, { type: "parameters", day: world.day, values: { salesTaxPct: 20 } });
    dispatch(world, {
      type: "answers",
      day: world.day,
      epoch: staleEpoch,
      answers: [{ key: bucket.key, approval: 1, inclinations: Array(10).fill(1) }],
    });

    expect(world.decisions.answers.size).toBe(0);
  });

  it("seeks to any moment of a recording from a keyframe", () => {
    const live = createWorld({ population: 800, seed: 14 });

    runDays(live, YEAR_DAYS);

    const keyframe = createKeyframe(live);

    dispatch(live, { type: "scenario", day: live.day, scenario: scenario("recession") });
    runDays(live, 100);

    const atDay100 = worldHash(live);

    dispatch(live, { type: "parameters", day: live.day, values: { incomeTaxPct: 40 } });
    runDays(live, YEAR_DAYS);

    const playback = structuredClone(keyframe);

    advanceTo(playback, live.log, YEAR_DAYS + 100);
    expect(worldHash(playback)).toBe(atDay100);

    advanceTo(playback, live.log, live.day);
    expect(worldHash(playback)).toBe(worldHash(live));
  });

  it("records when each life event happened and can carry on from a past moment", () => {
    const live = createWorld({ population: 1000, seed: 17 });

    runDays(live, YEAR_DAYS * 2);

    const { journal } = live;
    const days = journal.day.subarray(0, journal.count);

    expect(journal.count).toBeGreaterThan(50);
    expect(days.every((day, index) => index === 0 || day >= days[index - 1])).toBe(true);
    expect(journal.hour.subarray(0, journal.count).every((hour) => hour < 24)).toBe(true);

    const past = structuredClone(createKeyframe(live));

    runDays(live, YEAR_DAYS);

    const branch = continueFrom(past, live, "branch");

    expect(branch.recording).toBe(true);
    expect(branch.journal.day[branch.journal.count - 1]).toBeLessThanOrEqual(branch.day);

    runDays(branch, YEAR_DAYS);
    expect(worldHash(branch)).toBe(worldHash(live));
  });

  it("refuses a law that sets a value the town cannot enact", () => {
    const result = polisLawSchema.safeParse(law([], [{ parameter: "incomeTaxPct", value: 140 }]));

    expect(result.success).toBe(false);
  });
});

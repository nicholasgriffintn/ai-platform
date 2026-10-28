import { MACHINE_MAX_ACTIVE_RUNS, MACHINE_MAX_OPEN_RUNS } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { availableRunSlots, type CapacityRun } from "../run-capacity";

function runs(count: number, run: CapacityRun): CapacityRun[] {
  return Array.from({ length: count }, () => run);
}

const working: CapacityRun = { snapshot: { state: "running" } };
const waiting: CapacityRun = { snapshot: { state: "running" }, awaiting: ["approval-1"] };
const finished: CapacityRun = { snapshot: { state: "completed" } };

describe("desktop run capacity", () => {
  it("fills up with working runs and ignores finished ones", () => {
    expect(availableRunSlots(runs(MACHINE_MAX_ACTIVE_RUNS, working))).toBe(0);
    expect(availableRunSlots([...runs(MACHINE_MAX_ACTIVE_RUNS - 1, working), finished])).toBe(1);
  });

  it("does not let runs waiting on a person block new work", () => {
    expect(availableRunSlots(runs(MACHINE_MAX_ACTIVE_RUNS, waiting))).toBe(MACHINE_MAX_ACTIVE_RUNS);
  });

  it("still caps how many runs a desktop holds open", () => {
    expect(availableRunSlots(runs(MACHINE_MAX_OPEN_RUNS, waiting))).toBe(0);
    expect(availableRunSlots([...runs(MACHINE_MAX_OPEN_RUNS - 1, waiting), working])).toBe(0);
  });
});

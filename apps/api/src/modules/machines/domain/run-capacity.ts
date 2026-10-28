import {
  MACHINE_MAX_ACTIVE_RUNS,
  MACHINE_MAX_OPEN_RUNS,
  type MachineRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";

export interface CapacityRun {
  snapshot: Pick<MachineRunSnapshot, "state">;
  awaiting?: string[];
}

export function isOpenRun(run: CapacityRun): boolean {
  return run.snapshot.state === "pending" || run.snapshot.state === "running";
}

export function isWorkingRun(run: CapacityRun): boolean {
  return isOpenRun(run) && (run.awaiting ?? []).length === 0;
}

export function availableRunSlots(runs: Iterable<CapacityRun>): number {
  const all = [...runs];
  const open = all.filter(isOpenRun).length;
  const working = all.filter(isWorkingRun).length;

  return Math.max(0, Math.min(MACHINE_MAX_ACTIVE_RUNS - working, MACHINE_MAX_OPEN_RUNS - open));
}

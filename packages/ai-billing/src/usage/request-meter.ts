import { AsyncLocalStorage } from "node:async_hooks";

import type { UsageUnit } from "@ngriffin_uk/polychat-schemas";

export interface RequestInfraMeter {
  quantities: Map<UsageUnit, number>;
}

const meterStorage = new AsyncLocalStorage<RequestInfraMeter>();

export function createRequestInfraMeter(): RequestInfraMeter {
  return { quantities: new Map() };
}

export function runWithRequestInfraMeter<T>(meter: RequestInfraMeter, fn: () => T): T {
  return meterStorage.run(meter, fn);
}

export function addInfraUsage(unit: UsageUnit, quantity: number): void {
  const meter = meterStorage.getStore();

  if (!meter || !Number.isFinite(quantity) || quantity <= 0) {
    return;
  }

  meter.quantities.set(unit, (meter.quantities.get(unit) ?? 0) + quantity);
}

export function recordD1ResultMeta(
  meta: { rows_read?: number; rows_written?: number } | undefined,
): void {
  if (!meta) {
    return;
  }

  addInfraUsage("d1_rows_read", meta.rows_read ?? 0);
  addInfraUsage("d1_rows_written", meta.rows_written ?? 0);
}

export function drainRequestInfraMeter(
  meter: RequestInfraMeter,
): Array<{ unit: UsageUnit; quantity: number }> {
  const entries = Array.from(meter.quantities, ([unit, quantity]) => ({ unit, quantity })).filter(
    (entry) => entry.quantity > 0,
  );

  meter.quantities.clear();

  return entries;
}

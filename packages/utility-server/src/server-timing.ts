import { AsyncLocalStorage } from "node:async_hooks";

interface ServerTimingEntry {
  duration: number;
  count: number;
}

export type ServerTimings = Map<string, ServerTimingEntry>;

const timingStorage = new AsyncLocalStorage<ServerTimings>();

export function runWithServerTimings<T>(timings: ServerTimings, run: () => T): T {
  return timingStorage.run(timings, run);
}

export function recordServerTiming(name: string, duration: number): void {
  const timings = timingStorage.getStore();

  if (!timings || !Number.isFinite(duration)) {
    return;
  }

  const entry = timings.get(name) ?? { duration: 0, count: 0 };

  timings.set(name, { duration: entry.duration + duration, count: entry.count + 1 });
}

export async function timeServerPhase<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();

  try {
    return await run();
  } finally {
    recordServerTiming(name, performance.now() - started);
  }
}

export function formatServerTimings(timings: ServerTimings, total: number): string {
  const entries = [...timings].map(
    ([name, entry]) => `${name};dur=${entry.duration.toFixed(1)};desc="${entry.count}"`,
  );

  return [...entries, `total;dur=${total.toFixed(1)}`].join(", ");
}

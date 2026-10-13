import type { BenchmarkId } from "@ngriffin_uk/polychat-schemas";

import { countdown } from "./definitions/countdown.js";
import { fermiBets } from "./definitions/fermi-bets.js";
import { geoguess } from "./definitions/geoguess.js";
import { hamsterWheel } from "./definitions/hamster-wheel.js";
import { longOdds } from "./definitions/long-odds.js";
import { strudelGroove } from "./definitions/strudel-groove.js";
import type { Benchmark } from "./types.js";

export const BENCHMARKS: Readonly<Record<BenchmarkId, Benchmark>> = {
  geoguess,
  "hamster-wheel": hamsterWheel,
  countdown,
  "fermi-bets": fermiBets,
  "long-odds": longOdds,
  "strudel-groove": strudelGroove,
};

export function getBenchmark(id: BenchmarkId): Benchmark {
  return BENCHMARKS[id];
}

export function listBenchmarks(): Benchmark[] {
  return Object.values(BENCHMARKS);
}

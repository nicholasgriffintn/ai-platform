import { DAY_MS } from "./dates.js";

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(instant: Date): number {
  const cycles = (instant.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS / SYNODIC_MONTH_DAYS;

  return cycles - Math.floor(cycles);
}

export function moonLitPath(phase: number, cx: number, cy: number, radius: number): string {
  const waxing = phase < 0.5;
  const terminator = Math.abs(Math.cos(2 * Math.PI * phase)) * radius;
  const outerSweep = waxing ? 1 : 0;
  const terminatorSweep = phase < 0.25 || (phase >= 0.5 && phase < 0.75) ? 0 : 1;

  return [
    `M ${cx} ${cy - radius}`,
    `A ${radius} ${radius} 0 0 ${outerSweep} ${cx} ${cy + radius}`,
    `A ${terminator} ${radius} 0 0 ${terminatorSweep} ${cx} ${cy - radius}`,
    "Z",
  ].join(" ");
}

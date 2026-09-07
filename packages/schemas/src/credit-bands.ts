import { creditsFromCreditMicros } from "./pricing/constants.js";
import type { ChatRunUsage } from "./usage.js";

export const CREDIT_BAND_IDS = ["everyday", "deep-work", "big-build"] as const;

export type CreditBandId = (typeof CREDIT_BAND_IDS)[number];

export interface CreditBand {
  id: CreditBandId;
  label: string;
  from: number;
  to: number | null;
  description: string;
  example: string;
}

export const CREDIT_BANDS: readonly CreditBand[] = [
  {
    id: "everyday",
    label: "Everyday ask",
    from: 0,
    to: 1,
    description: "A question, a summary, a bit of research. Most of what you do lands here.",
    example: "A quick question",
  },
  {
    id: "deep-work",
    label: "Deep work",
    from: 1,
    to: 25,
    description: "A teammate reading widely, drafting properly, or working through a task.",
    example: "A couple of hours of sandboxed coding",
  },
  {
    id: "big-build",
    label: "Big build",
    from: 25,
    to: null,
    description: "A long run: many stages, a sandbox, or a job that goes away and comes back.",
    example: "A long teammate task",
  },
];

export function describeCreditBand(credits: number): CreditBand {
  const safe = Number.isFinite(credits) ? Math.max(credits, 0) : 0;

  return (
    CREDIT_BANDS.find((band) => safe >= band.from && (band.to === null || safe < band.to)) ??
    CREDIT_BANDS[CREDIT_BANDS.length - 1]
  );
}

export function formatCreditBandRange(band: CreditBand): string {
  if (band.to === null) {
    return `${band.from.toLocaleString()} credits and up`;
  }

  return band.from === 0
    ? `Under ${band.to.toLocaleString()} credits`
    : `${band.from.toLocaleString()}–${band.to.toLocaleString()} credits`;
}

export function sumRunCreditMicros(runs: ReadonlyArray<ChatRunUsage | undefined>): number {
  return runs.reduce((total, run) => total + (run?.consumption.creditMicros ?? 0), 0);
}

export function summariseCreditSpend(creditMicros: number): {
  credits: number;
  band: CreditBand;
} {
  const credits = creditsFromCreditMicros(creditMicros);

  return { credits, band: describeCreditBand(credits) };
}

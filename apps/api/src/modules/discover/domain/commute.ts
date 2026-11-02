import type { DiscoverObservation, TransitJourney } from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

function selectDiscoverJourney(journeys: readonly TransitJourney[]) {
  return (
    [...journeys].sort((left, right) => left.durationMinutes - right.durationMinutes)[0] ?? null
  );
}

export function discoverCommuteMaterial(
  journeys: readonly TransitJourney[],
  input: { baselineMinutes?: number; alertDelayMinutes: number },
): string {
  const journey = selectDiscoverJourney(journeys);

  return JSON.stringify(
    journey
      ? {
          delayBand: Math.floor(
            Math.max(
              0,
              journey.durationMinutes - (input.baselineMinutes ?? journey.durationMinutes),
            ) / input.alertDelayMinutes,
          ),
          disruptions: [...new Set(journey.disruptions)].sort(),
        }
      : null,
  );
}

export function describeDiscoverCommute(
  journeys: readonly TransitJourney[],
  input: {
    direction: "outbound" | "returning";
    date: string;
    departure: string;
    now: Date;
    fingerprint: string;
    baselineMinutes?: number;
    alertDelayMinutes: number;
  },
): DiscoverObservation | null {
  const journey = selectDiscoverJourney(journeys);

  if (!journey) {
    return null;
  }

  const baselineMinutes = input.baselineMinutes ?? journey.durationMinutes;

  return {
    id: `travel:${input.date}:${input.direction}`,
    kind: "travel",
    providerId: "tfl",
    title: input.direction === "outbound" ? "Your journey to work" : "Your journey home",
    text: truncateSingleLine(
      [
        `${Math.ceil(journey.durationMinutes)} minutes by public transport, departing around ${input.departure}.`,
        ...journey.disruptions.slice(0, 2),
      ].join(" "),
      1000,
    ),
    source: "Powered by the Transport for London Journey Planner API",
    href: "https://tfl.gov.uk/plan-a-journey/",
    observedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + 15 * 60 * 1000).toISOString(),
    actionable:
      journey.disruptions.length > 0 ||
      journey.durationMinutes - baselineMinutes >= input.alertDelayMinutes,
    fingerprint: input.fingerprint,
    stale: false,
    journey: { durationMinutes: journey.durationMinutes, baselineMinutes },
  };
}

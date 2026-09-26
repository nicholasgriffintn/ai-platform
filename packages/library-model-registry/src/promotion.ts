import type { AliasGate, ScoreSummary } from "@ngriffin_uk/polychat-schemas";

export interface GateResult {
  passed: boolean;
  scores: Record<string, number>;
  failures: string[];
}

export function evaluateGate(
  gate: AliasGate,
  scores: Record<string, ScoreSummary> | null,
): GateResult {
  if (!scores) {
    return { passed: false, scores: {}, failures: ["No completed run of the gate suite"] };
  }

  const means = Object.fromEntries(
    Object.entries(scores).map(([metric, summary]) => [metric, summary.mean]),
  );
  const failures = Object.entries(gate.thresholds).flatMap(([metric, threshold]) => {
    const value = means[metric];

    if (value === undefined) {
      return [`${metric} was not scored`];
    }

    return value < threshold
      ? [`${metric} ${value.toFixed(2)} is below ${threshold.toFixed(2)}`]
      : [];
  });

  return { passed: failures.length === 0, scores: means, failures };
}

export function pickCanaryRoute(
  canary: { routeId: string; percent: number } | null,
  primaryRouteId: string | null,
  roll: number,
): string | null {
  if (!canary || canary.percent <= 0) {
    return primaryRouteId;
  }

  return roll * 100 < canary.percent ? canary.routeId : primaryRouteId;
}

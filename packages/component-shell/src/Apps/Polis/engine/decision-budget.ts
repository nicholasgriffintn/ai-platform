import {
  POLIS_ACTION_LABELS,
  POLIS_ACTIONS,
  POLIS_MAX_BUCKETS_PER_REQUEST,
  type PolisBucket,
  type PolisBucketAnswer,
} from "@ngriffin_uk/polychat-schemas";

import type { PolisDecisionStats, PolisModelSettings } from "./protocol.js";

const MAX_RECENT = 8;

export function emptyDecisionStats(): PolisDecisionStats {
  return { calls: 0, tokens: 0, callsThisYear: 0, model: null, error: null, recent: [] };
}

export function requestSize(settings: PolisModelSettings, stats: PolisDecisionStats): number {
  return Math.max(
    0,
    Math.min(POLIS_MAX_BUCKETS_PER_REQUEST, settings.callsPerYear - stats.callsThisYear),
  );
}

function bucketLabel(bucket: PolisBucket): string {
  return `${bucket.wealth} ${bucket.age} ${bucket.tenure}`.replaceAll("_", " ");
}

export function strongestLeanings(
  buckets: readonly PolisBucket[],
  answers: readonly PolisBucketAnswer[],
): PolisDecisionStats["recent"] {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  return answers.slice(0, MAX_RECENT).flatMap((answer) => {
    const bucket = byKey.get(answer.key);

    if (!bucket) {
      return [];
    }

    const [action] = [...POLIS_ACTIONS].sort(
      (first, second) => (answer.inclinations[second] ?? 0) - (answer.inclinations[first] ?? 0),
    );

    return [
      {
        label: bucketLabel(bucket),
        action: POLIS_ACTION_LABELS[action],
        probability: answer.inclinations[action] ?? 0,
      },
    ];
  });
}

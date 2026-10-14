import type { BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import {
  formatProbabilityPercent,
  getBooleanProperty,
  getNumberProperty,
  getStringProperty,
} from "@ngriffin_uk/polychat-utility-core";

import { ProbabilityBar } from "../../Apps/Decisions/ProbabilityBar.js";

const BINS = 5;

function calibrationBins(items: readonly BenchmarkItemDetail[]) {
  const bins = Array.from({ length: BINS }, () => ({ said: 0, yes: 0, count: 0 }));

  for (const detail of items) {
    const probability = getNumberProperty(detail.result?.answer, "probability");
    const answer = getBooleanProperty(detail.reveal, "answer");

    if (probability === undefined || answer === undefined) {
      continue;
    }

    const bin = bins[Math.min(BINS - 1, Math.floor(probability * BINS))];

    bin.said += probability;
    bin.yes += answer ? 1 : 0;
    bin.count += 1;
  }

  return bins;
}

function Calibration({ items }: { items: readonly BenchmarkItemDetail[] }) {
  return (
    <div className="grid grid-cols-5 gap-2" aria-label="Calibration by confidence band">
      {calibrationBins(items).map((bin, index) => (
        <div
          key={`band-${index * 20}`}
          className="rounded-lg border border-border bg-surface p-2 text-center"
        >
          <p className="font-mono text-[10px] text-muted-foreground">
            {index * 20}–{(index + 1) * 20}%
          </p>
          <p className="font-display text-lg text-foreground tabular-nums">
            {bin.count === 0 ? "–" : `${Math.round((bin.yes / bin.count) * 100)}%`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {bin.count === 0 ? "no answers" : `were yes, of ${bin.count}`}
          </p>
        </div>
      ))}
    </div>
  );
}

function Verdict({ detail }: { detail: BenchmarkItemDetail }) {
  const probability = getNumberProperty(detail.result?.answer, "probability");
  const correct = getBooleanProperty(detail.result?.detail, "correct");

  if (probability === undefined) {
    return <span className="shrink-0 text-xs text-failure">No usable answer</span>;
  }

  if (probability === 0.5) {
    return <span className="shrink-0 text-xs text-attention">On the fence</span>;
  }

  return (
    <span className={correct ? "shrink-0 text-xs text-success" : "shrink-0 text-xs text-failure"}>
      Said {probability > 0.5 ? "yes" : "no"} · {correct ? "right" : "wrong"}
    </span>
  );
}

export function LongOddsItems({ items }: { items: readonly BenchmarkItemDetail[] }) {
  return (
    <div className="space-y-4">
      <Calibration items={items} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((detail) => {
          const probability = getNumberProperty(detail.result?.answer, "probability");
          const answer = getBooleanProperty(detail.reveal, "answer");

          return (
            <li key={detail.item.id} className="space-y-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-foreground">{getStringProperty(detail.item.data, "question")}</p>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    Truth
                  </span>
                  <span
                    className={answer ? "font-medium text-success" : "font-medium text-failure"}
                  >
                    {answer ? "Yes" : "No"}
                  </span>
                </span>
              </div>
              {probability === undefined ? null : (
                <ProbabilityBar
                  label="Chance of yes"
                  probability={probability}
                  detail={formatProbabilityPercent(probability)}
                />
              )}
              <Verdict detail={detail} />
              <p className="text-xs text-muted-foreground">
                {getStringProperty(detail.reveal, "note")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

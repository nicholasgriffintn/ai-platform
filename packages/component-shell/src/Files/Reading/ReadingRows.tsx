import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReadingForm, SourceReading } from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";

import { PROBABILITY_FILL_CLASS, probabilityTone } from "../../Apps/Decisions/probability.js";
import { readRows, type ReadingRow } from "./reading.js";

function Row({ row }: { row: ReadingRow }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border/60 py-2 last:border-b-0">
      <dt className="truncate text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
        {row.label}
      </dt>
      <dd className="min-w-0">
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            row.found ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {row.value}
        </span>
        {row.detail && <span className="ml-2 text-xs text-muted-foreground">{row.detail}</span>}
        {row.needsLook && (
          <span className="ml-2 text-[11px] text-attention">worth a second look</span>
        )}
      </dd>
      <dd
        className="flex items-center justify-end gap-1.5 whitespace-nowrap"
        aria-label="Confidence"
      >
        {row.confidence !== null && (
          <>
            <span className="h-1 w-6 overflow-hidden rounded-full bg-border" aria-hidden>
              <span
                className={cn(
                  "block h-full rounded-full",
                  PROBABILITY_FILL_CLASS[probabilityTone(row.confidence)],
                )}
                style={{ width: `${Math.max(8, Math.round(row.confidence * 100))}%` }}
              />
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {formatProbabilityPercent(row.confidence)}
            </span>
          </>
        )}
      </dd>
    </div>
  );
}

export function ReadingRows({ form, reading }: { form: ReadingForm; reading: SourceReading }) {
  return (
    <dl>
      {readRows(form, reading.answers).map((row) => (
        <Row key={row.name} row={row} />
      ))}
    </dl>
  );
}

import { cn, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";

import { PROBABILITY_FILL_CLASS, probabilityTone } from "../Decisions/probability.js";
import type { PaperworkForm } from "./forms.js";
import { HighlightedText } from "./HighlightedText.js";
import { readRows, readSpans, type ReadingRow } from "./reading.js";
import type { PaperworkDocument } from "./usePaperwork.js";

function Row({ row }: { row: ReadingRow }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3.5rem] items-baseline gap-3 border-b border-border/60 py-2 last:border-b-0">
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
      <dd className="flex items-center justify-end gap-1.5" aria-label="Confidence">
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

export function ReadingCard({
  document,
  form,
}: {
  document: PaperworkDocument;
  form: PaperworkForm;
}) {
  const response = document.state === "read" ? document.response : null;
  const sourceText = response?.state_text ?? document.text;

  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <h3 className="truncate font-display text-lg" title={document.name}>
          {document.name}
        </h3>
        {document.previewUrl && (
          <img
            src={document.previewUrl}
            alt=""
            className="max-h-64 w-full rounded-lg object-contain ring-1 ring-border"
          />
        )}
        {sourceText && (
          <HighlightedText text={sourceText} spans={response ? readSpans(response) : []} />
        )}
      </div>
      <div className="min-w-0">
        {document.state === "failed" ? (
          <p className="text-sm text-failure">{document.error}</p>
        ) : response ? (
          <dl>
            {readRows(form, response).map((row) => (
              <Row key={row.name} row={row} />
            ))}
            {response.truncated && (
              <p className="pt-2 text-xs text-attention">
                Only part of this fitted, so some figures may be missing.
              </p>
            )}
          </dl>
        ) : (
          <LoadingSpinner
            className="h-full min-h-24"
            message={
              document.state === "reading" ? "Reading every field at once" : "Waiting its turn"
            }
          />
        )}
      </div>
    </article>
  );
}

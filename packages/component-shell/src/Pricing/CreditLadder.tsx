import { CREDIT_BANDS, formatCreditBandRange } from "@ngriffin_uk/polychat-schemas";

const MIN_WIDTH = 12;

function bandWidth(index: number): number {
  return MIN_WIDTH + ((100 - MIN_WIDTH) * (index + 1)) / CREDIT_BANDS.length;
}

export function CreditLadder() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="polychat-eyebrow">Roughly</p>
      <h3 className="mt-2 font-display text-xl font-medium tracking-tight text-foreground">
        What a credit buys
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Every line draws at the vendor's actual rate. Work falls into three bands, and you see which
        one a task reached while it is still running.
      </p>
      <ol className="mt-5 space-y-4">
        {CREDIT_BANDS.map((band, index) => (
          <li key={band.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-foreground">{band.label}</span>
              <span className="font-mono text-xs text-foreground tabular-nums">
                {formatCreditBandRange(band)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {band.description} For example: {band.example.toLowerCase()}.
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                aria-hidden
                className="h-full rounded-full bg-active-work"
                style={{ width: `${bandWidth(index)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

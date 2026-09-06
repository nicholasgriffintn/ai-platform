import { CREDIT_BANDS, formatCreditBandRange } from "@ngriffin_uk/polychat-schemas";

const MIN_WIDTH = 12;

function bandWidth(index: number): number {
  return MIN_WIDTH + ((100 - MIN_WIDTH) * (index + 1)) / CREDIT_BANDS.length;
}

export function CreditLadder() {
  return (
    <div className="bg-surface border-border rounded-xl border p-5">
      <p className="polychat-eyebrow">Roughly</p>
      <h3 className="font-display text-foreground mt-2 text-xl font-medium tracking-tight">
        What a credit buys
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Every line draws at the vendor's actual rate. Work falls into three bands, and you see which
        one a task reached while it is still running.
      </p>
      <ol className="mt-5 space-y-4">
        {CREDIT_BANDS.map((band, index) => (
          <li key={band.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-foreground">{band.label}</span>
              <span className="text-foreground font-mono text-xs tabular-nums">
                {formatCreditBandRange(band)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {band.description} For example: {band.example.toLowerCase()}.
            </p>
            <div className="bg-surface-elevated h-2 w-full overflow-hidden rounded-full">
              <div
                aria-hidden
                className="bg-active-work h-full rounded-full"
                style={{ width: `${bandWidth(index)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

import { creditsFromCreditMicros, type RunMeter } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

const FILL_TONES: Record<RunMeter["state"], string> = {
  uncapped: "bg-active-work",
  ok: "bg-active-work",
  near: "bg-attention",
  reached: "bg-failure",
};

export interface RunCostMeterProps {
  meter: Pick<RunMeter, "chargedCreditMicros" | "capCreditMicros" | "state">;
  paused?: boolean;
}

export function runCostMeterLabel(meter: RunCostMeterProps["meter"]): string {
  const charged = formatCredits(creditsFromCreditMicros(meter.chargedCreditMicros));

  return meter.capCreditMicros
    ? `${charged} of ${formatCredits(creditsFromCreditMicros(meter.capCreditMicros))} credits`
    : `${charged} credits so far`;
}

export function RunCostMeter({ meter, paused = false }: RunCostMeterProps) {
  const label = runCostMeterLabel(meter);
  const percent = meter.capCreditMicros
    ? Math.min(100, (meter.chargedCreditMicros / meter.capCreditMicros) * 100)
    : null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground">
        {paused ? "Run paused" : "This run"}
      </span>
      {percent !== null ? (
        <>
          <meter className="sr-only" min={0} max={100} value={percent} aria-label={label} />
          <div
            aria-hidden="true"
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-elevated"
          >
            <div
              className={`h-full rounded-full ${FILL_TONES[meter.state]}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : null}
      <span className="shrink-0 tabular-nums">{label}</span>
    </div>
  );
}

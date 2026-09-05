import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

interface CreditLadderRung {
  label: string;
  credits: number;
}

const CREDIT_LADDER: CreditLadderRung[] = [
  { label: "A quick question", credits: 0.1 },
  { label: "A couple of hours of sandboxed coding", credits: 6 },
  { label: "A long agent task", credits: 100 },
];

const MIN_EXPONENT = Math.log10(CREDIT_LADDER[0].credits);
const MAX_EXPONENT = Math.log10(CREDIT_LADDER[CREDIT_LADDER.length - 1].credits);
const MIN_WIDTH = 8;

function rungWidth(credits: number): number {
  const ratio = (Math.log10(credits) - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT);

  return MIN_WIDTH + (100 - MIN_WIDTH) * ratio;
}

export function CreditLadder() {
  return (
    <div className="bg-surface border-border rounded-xl border p-5">
      <p className="polychat-eyebrow">Roughly</p>
      <h3 className="font-display text-foreground mt-2 text-xl font-medium tracking-tight">
        What a credit buys
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Every line draws at the vendor's actual rate, so the ladder is logarithmic: each rung is a
        different order of magnitude.
      </p>
      <ol className="mt-5 space-y-4">
        {CREDIT_LADDER.map((rung) => (
          <li key={rung.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-foreground">{rung.label}</span>
              <span className="text-foreground font-mono text-xs tabular-nums">
                {formatCredits(rung.credits)} {rung.credits === 1 ? "credit" : "credits"}
              </span>
            </div>
            <div className="bg-surface-elevated h-2 w-full overflow-hidden rounded-full">
              <div
                aria-hidden
                className="bg-active-work h-full rounded-full"
                style={{ width: `${rungWidth(rung.credits)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

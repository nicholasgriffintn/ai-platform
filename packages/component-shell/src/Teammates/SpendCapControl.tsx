import { Button, Input } from "@ngriffin_uk/polychat-component-ui";
import type { SpendLedger } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useId, useState } from "react";

const MICROS_PER_CREDIT = 1_000_000;

export function creditsFromMicros(micros: number): number {
  return micros / MICROS_PER_CREDIT;
}

export function microsFromCredits(credits: number): number {
  return Math.round(credits * MICROS_PER_CREDIT);
}

export function describeSpend(ledger: SpendLedger | undefined): string {
  if (!ledger) {
    return "Spend unavailable";
  }

  const spent = `${formatCredits(creditsFromMicros(ledger.creditMicros))} credits this month`;

  if (!ledger.capCreditMicros) {
    return spent;
  }

  return `${spent} of ${formatCredits(creditsFromMicros(ledger.capCreditMicros))}`;
}

export function spendStateCopy(ledger: SpendLedger | undefined): string | null {
  switch (ledger?.state) {
    case "reached":
      return "Budget reached. Runs are refused until the cap is raised or the month resets.";
    case "near":
      return "Close to the monthly budget.";
    default:
      return null;
  }
}

export function SpendCapControl({
  ledger,
  isPending,
  onSave,
}: {
  ledger: SpendLedger | undefined;
  isPending: boolean;
  onSave: (monthlyCreditCapMicros: number | null) => void;
}) {
  const inputId = useId();
  const currentCap = ledger?.capCreditMicros ? creditsFromMicros(ledger.capCreditMicros) : null;
  const [value, setValue] = useState(currentCap === null ? "" : String(currentCap));

  useEffect(() => {
    setValue(currentCap === null ? "" : String(currentCap));
  }, [currentCap]);

  const parsed = value.trim() === "" ? null : Number(value);
  const valid = parsed === null || (Number.isFinite(parsed) && parsed > 0);
  const changed =
    (parsed === null ? null : microsFromCredits(parsed)) !== (ledger?.capCreditMicros ?? null);
  const state = spendStateCopy(ledger);

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (valid) {
          onSave(parsed === null ? null : microsFromCredits(parsed));
        }
      }}
    >
      <p className="text-sm text-foreground">{describeSpend(ledger)}</p>
      {state ? <p className="text-xs text-muted-foreground">{state}</p> : null}
      <div className="flex items-end gap-2">
        <label htmlFor={inputId} className="flex-1 text-xs text-muted-foreground">
          Monthly cap in credits, blank for none
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value}
            aria-invalid={!valid}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1"
          />
        </label>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!valid || !changed || isPending}
        >
          Save cap
        </Button>
      </div>
    </form>
  );
}

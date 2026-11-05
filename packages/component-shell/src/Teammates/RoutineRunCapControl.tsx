import { Button, Input } from "@ngriffin_uk/polychat-component-ui";
import { creditMicrosFromCredits, creditsFromCreditMicros } from "@ngriffin_uk/polychat-schemas";
import { useId, useState } from "react";

export function RoutineRunCapControl({
  capCreditMicros,
  isPending,
  onSave,
}: {
  capCreditMicros: number | null;
  isPending: boolean;
  onSave: (capCreditMicros: number | null) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(
    capCreditMicros === null ? "" : String(creditsFromCreditMicros(capCreditMicros)),
  );
  const parsed = value.trim() === "" ? null : Number(value);
  const valid = parsed === null || (Number.isFinite(parsed) && parsed > 0);
  const nextCap = parsed === null ? null : creditMicrosFromCredits(parsed);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (valid) {
          onSave(nextCap);
        }
      }}
    >
      <label htmlFor={inputId} className="flex-1 text-xs text-muted-foreground">
        Cap per run in credits, blank for none
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
        disabled={!valid || nextCap === capCreditMicros || isPending}
      >
        Save cap
      </Button>
    </form>
  );
}

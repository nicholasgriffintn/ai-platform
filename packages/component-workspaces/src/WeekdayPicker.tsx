import { cn } from "@ngriffin_uk/polychat-component-ui";
import { SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";

export function WeekdayPicker({
  days,
  disabled,
  keepOne = false,
  onChange,
}: {
  days: readonly number[];
  disabled: boolean;
  keepOne?: boolean;
  onChange: (days: number[]) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-1 text-sm font-medium">Days</legend>
      {SHORT_WEEKDAY_LABELS.map((day, index) => {
        const active = days.includes(index);

        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            disabled={disabled || (keepOne && active && days.length === 1)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              active
                ? "border-active-work bg-active-work/10 text-active-work"
                : "border-border text-muted-foreground hover:border-border-strong",
            )}
            onClick={() =>
              onChange(
                active
                  ? days.filter((candidate) => candidate !== index)
                  : [...days, index].sort((left, right) => left - right),
              )
            }
          >
            {day}
          </button>
        );
      })}
    </fieldset>
  );
}

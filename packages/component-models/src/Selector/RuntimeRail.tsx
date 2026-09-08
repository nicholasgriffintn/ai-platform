import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComputeSite } from "@ngriffin_uk/polychat-schemas";

export interface RuntimeRailOption {
  site: ComputeSite;
  machineId?: string;
  label: string;
}

export interface RuntimeRailProps {
  options: RuntimeRailOption[];
  disabled?: boolean;
  searching?: boolean;
  selected: ComputeSite;
  selectedMachineId?: string;
  onSelect: (site: ComputeSite, machineId?: string) => void;
}

export function RuntimeRail({
  options,
  selected,
  selectedMachineId,
  onSelect,
  disabled,
  searching = false,
}: RuntimeRailProps) {
  return (
    <div
      className="flex h-7 min-w-0 flex-1 gap-1 overflow-x-auto"
      role="radiogroup"
      aria-label="Model source"
    >
      {searching && (
        <span
          role="status"
          className="shrink-0 rounded-md bg-active-work/10 px-3 py-1 text-xs font-medium text-active-work"
        >
          All locations
        </span>
      )}
      {options.map((option, index) => {
        const isSelected =
          !searching &&
          option.site === selected &&
          (option.site !== "machine" || option.machineId === selectedMachineId);

        return (
          <button
            key={`${option.site}:${option.machineId ?? "default"}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            tabIndex={
              isSelected ||
              (index === 0 &&
                (searching ||
                  !options.some(
                    (item) =>
                      item.site === selected &&
                      (item.site !== "machine" || item.machineId === selectedMachineId),
                  )))
                ? 0
                : -1
            }
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) %
                      options.length;
              const next = options[nextIndex];

              onSelect(next.site, next.machineId);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
                [nextIndex]?.focus();
            }}
            onClick={() => onSelect(option.site, option.machineId)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              isSelected
                ? "bg-active-work/10 text-active-work"
                : "text-muted-foreground hover:bg-selection/60 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

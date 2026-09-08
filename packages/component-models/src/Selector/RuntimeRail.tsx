import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComputeSite } from "@ngriffin_uk/polychat-schemas";

export interface RuntimeRailOption {
  site: ComputeSite;
  machineId?: string;
  label: string;
}

export interface RuntimeRailProps {
  options: RuntimeRailOption[];
  selected: ComputeSite;
  selectedMachineId?: string;
  onSelect: (site: ComputeSite, machineId?: string) => void;
}

export function RuntimeRail({ options, selected, selectedMachineId, onSelect }: RuntimeRailProps) {
  return (
    <div className="flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Model source">
      {options.map((option) => {
        const isSelected =
          option.site === selected &&
          (option.site !== "machine" || option.machineId === selectedMachineId);

        return (
          <button
            key={`${option.site}:${option.machineId ?? "default"}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.site, option.machineId)}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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

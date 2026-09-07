import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComputeSite, Readiness } from "@ngriffin_uk/polychat-schemas";
import { Check, Circle, CircleSlash, LoaderCircle } from "lucide-react";

export interface RuntimeRailOption {
  site: ComputeSite;
  machineId?: string;
  label: string;
  detail?: string;
  readiness: Readiness;
}

export interface RuntimeRailProps {
  options: RuntimeRailOption[];
  selected: ComputeSite;
  selectedMachineId?: string;
  onSelect: (site: ComputeSite, machineId?: string) => void;
}

function getReadinessIcon(readiness: Readiness) {
  switch (readiness.state) {
    case "ready":
      return Check;
    case "unavailable":
      return CircleSlash;
    case "unknown":
      return LoaderCircle;
    default:
      return Circle;
  }
}

function getReadinessClassName(readiness: Readiness) {
  switch (readiness.state) {
    case "ready":
      return "text-success";
    case "setup_required":
      return "text-attention";
    case "unavailable":
      return "text-failure";
    default:
      return "text-muted-foreground";
  }
}

export function RuntimeRail({ options, selected, selectedMachineId, onSelect }: RuntimeRailProps) {
  return (
    <div className="flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Compute site">
      {options.map((option) => {
        const isSelected =
          option.site === selected &&
          (option.site !== "machine" || option.machineId === selectedMachineId);
        const isReady = option.readiness.state === "ready";
        const Icon = getReadinessIcon(option.readiness);
        const detail = option.detail ?? option.readiness.reason;

        return (
          <div
            key={`${option.site}:${option.machineId ?? "default"}`}
            className={cn(
              "flex min-w-[8.5rem] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
              isSelected
                ? "border-active-work/45 bg-active-work/10"
                : "border-transparent hover:border-border-strong hover:bg-selection/60",
            )}
            data-readiness={option.readiness.state}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${option.label}: ${detail}`}
              disabled={!isReady}
              onClick={() => onSelect(option.site, option.machineId)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  getReadinessClassName(option.readiness),
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    option.readiness.state === "unknown" && "animate-spin",
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {option.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
              </span>
            </button>
            {option.readiness.action && (
              <button
                type="button"
                className="shrink-0 text-[11px] font-medium text-active-work hover:underline"
                onClick={() => onSelect(option.site, option.machineId)}
              >
                {option.readiness.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

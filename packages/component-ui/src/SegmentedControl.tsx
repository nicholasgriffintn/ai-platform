import { cn } from "./utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  label,
  onChange,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  label: string;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex w-fit gap-0.5 rounded-md bg-selection/60 p-0.5", className)}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={cn(
            "flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors",
            value === option.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count ? (
            <span className="text-muted-foreground tabular-nums">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

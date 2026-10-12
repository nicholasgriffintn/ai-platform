import { cn } from "@ngriffin_uk/polychat-component-ui";

export function StepScale({
  label,
  steps,
  active,
  activeClassName = "bg-foreground",
}: {
  label: string;
  steps: readonly string[];
  active: number;
  activeClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{steps[active] ?? ""}</span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-500",
              index === active
                ? activeClassName
                : index < active
                  ? "bg-foreground/25"
                  : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

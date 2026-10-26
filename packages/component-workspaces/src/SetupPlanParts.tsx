import { Button } from "@ngriffin_uk/polychat-component-ui";
import { creditsFromCreditMicros } from "@ngriffin_uk/polychat-schemas";
import { formatCredits, formatMinutesInterval } from "@ngriffin_uk/polychat-utility-core";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function formatCap(micros: number | null): string {
  return micros ? `${formatCredits(creditsFromCreditMicros(micros))} credits a month` : "No cap";
}

export function formatWake(minutes: number | null): string {
  if (!minutes) {
    return "Wakes when work arrives";
  }

  return `Checks in every ${formatMinutesInterval(minutes)}`;
}

export function PlanSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {count !== undefined ? (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <X size={14} />
    </Button>
  );
}

export function PlanEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

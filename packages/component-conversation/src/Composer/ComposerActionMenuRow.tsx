import { Check } from "lucide-react";
import type { ReactNode } from "react";

export const composerActionMenuRowClassName =
  "rounded-lg px-3 py-2.5 text-sm data-[highlighted]:bg-selection data-[highlighted]:text-foreground";

export function ComposerActionMenuRow({
  description,
  icon,
  isActive = false,
  label,
}: {
  description?: string;
  icon: ReactNode;
  isActive?: boolean;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-5 font-medium">{label}</span>
        {description ? (
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {isActive ? <Check className="h-4 w-4 shrink-0 text-active-work" aria-hidden="true" /> : null}
    </div>
  );
}

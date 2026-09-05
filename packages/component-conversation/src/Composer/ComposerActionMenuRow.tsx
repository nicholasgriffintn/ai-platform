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
        className="text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{label}</span>
        {description ? (
          <span className="text-muted-foreground block truncate text-xs">{description}</span>
        ) : null}
      </span>
      {isActive ? <Check className="text-active-work h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </div>
  );
}

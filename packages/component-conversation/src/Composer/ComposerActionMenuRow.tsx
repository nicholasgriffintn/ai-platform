import { Check } from "lucide-react";
import type { ReactNode } from "react";

export const composerActionMenuRowClassName =
  "rounded-lg px-3 py-2.5 text-sm data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800";

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
        className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 dark:text-zinc-300"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{label}</span>
        {description ? (
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </span>
        ) : null}
      </span>
      {isActive ? <Check className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" /> : null}
    </div>
  );
}

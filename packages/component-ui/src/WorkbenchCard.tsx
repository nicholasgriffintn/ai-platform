import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { cn } from "./utils";

export interface WorkbenchCardProps {
  title: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export function WorkbenchCard({
  title,
  icon: Icon,
  aside,
  className,
  defaultOpen = true,
  children,
}: WorkbenchCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const hasBody = children !== undefined && children !== null && children !== false;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border border-border bg-surface text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex min-h-9 items-center gap-1.5 px-3">
        <button
          type="button"
          aria-expanded={hasBody ? open : undefined}
          aria-controls={hasBody ? bodyId : undefined}
          disabled={!hasBody}
          onClick={() => setOpen((current) => !current)}
          className="polychat-motion-micro -ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default"
        >
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          <h3 id={titleId} className="truncate text-xs font-medium text-foreground">
            {title}
          </h3>
          {hasBody ? (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "polychat-motion-micro size-3 shrink-0 transition-transform",
                !open && "-rotate-90",
              )}
            />
          ) : null}
        </button>
        {aside ? <div className="ml-auto flex min-w-0 items-center gap-1">{aside}</div> : null}
      </div>
      {hasBody && open ? (
        <div id={bodyId} className="px-3 pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export interface WorkbenchFactProps {
  icon?: LucideIcon;
  leading?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  title?: string;
}

export function WorkbenchFact({ icon: Icon, leading, label, value, title }: WorkbenchFactProps) {
  return (
    <div className="flex min-h-6 min-w-0 items-center gap-2" title={title}>
      {leading ?? (Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null)}
      <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      {value !== undefined ? (
        <span className="shrink-0 font-mono text-[11px] tabular-nums">{value}</span>
      ) : null}
    </div>
  );
}

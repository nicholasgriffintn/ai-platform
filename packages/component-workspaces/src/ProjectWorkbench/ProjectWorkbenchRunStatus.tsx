import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectWorkbenchStatus } from "@ngriffin_uk/polychat-utility-react";

import { STATUS_PRESENTATION } from "./projectWorkbenchPresentation";

export function ProjectWorkbenchRunStatus({
  status,
  statusDetail,
}: {
  status: ProjectWorkbenchStatus;
  statusDetail?: string;
}) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <output
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-2",
        presentation.requiresAttention && "rounded-md bg-attention/10 px-2 py-1",
      )}
      title={statusDetail ? `${presentation.label} · ${statusDetail}` : presentation.label}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          presentation.tone,
          presentation.animated && "animate-pulse",
        )}
      />
      <span
        className={cn(
          "shrink-0 text-xs font-medium sm:text-sm",
          presentation.requiresAttention && "text-attention",
        )}
      >
        {presentation.label}
      </span>
      {statusDetail ? (
        <>
          <span className="sr-only">: {statusDetail}</span>
          <span
            aria-hidden="true"
            className="hidden min-w-0 truncate text-xs text-muted-foreground @min-[48rem]:block"
          >
            {statusDetail}
          </span>
        </>
      ) : null}
    </output>
  );
}

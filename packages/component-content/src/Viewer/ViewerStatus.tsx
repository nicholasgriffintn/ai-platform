import { Skeleton } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

function DocumentSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-10" aria-hidden="true">
      <Skeleton className="mb-3 h-7 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function ViewerStatus({
  label,
  actions,
  children,
}: {
  label: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-canvas"
      aria-busy={children ? undefined : true}
      aria-label={label}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <Skeleton className="h-9 w-56 rounded-full" />
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children ?? <DocumentSkeleton />}</div>
    </div>
  );
}

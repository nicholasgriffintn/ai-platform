import type { ReactNode } from "react";

import { Card } from "../Card";
import { PageShellHeader } from "../Page/PageShellHeader";
import { Skeleton } from "../Skeleton";
import { cn } from "../utils";

/**
 * Scope-neutral loading states. Nothing here may name a workspace, a project, or a person:
 * Chat and Work render the same surfaces and must not borrow each other's vocabulary.
 */
export function LoadingRegion({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({
  title,
  actionCount = 0,
}: {
  title: string;
  actionCount?: number;
}) {
  return (
    <>
      <PageShellHeader
        title={title}
        actionContent={
          actionCount > 0 ? (
            <div className="flex shrink-0 gap-2">
              {Array.from({ length: actionCount }, (_, index) => (
                <Skeleton key={index} className="h-8 w-8 sm:w-24" />
              ))}
            </div>
          ) : undefined
        }
      />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
    </>
  );
}

export function SkeletonCardGrid({ className, count = 4 }: { className?: string; count?: number }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="gap-4 p-6 shadow-none">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-6 w-2/3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="flex gap-4 border-t border-border pt-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </Card>
  );
}

export function CardGridLoadingSkeleton({
  count,
  gridClassName,
  label,
}: {
  count?: number;
  gridClassName?: string;
  label: string;
}) {
  return (
    <LoadingRegion label={label}>
      <SkeletonCardGrid className={gridClassName} count={count} />
    </LoadingRegion>
  );
}

/** Body content for a surface whose header is already rendered by its route. */
export function ContentLoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <LoadingRegion label={label} className="space-y-5">
      <Skeleton className="h-9 w-56 max-w-full" />
      <SkeletonCardGrid count={4} />
    </LoadingRegion>
  );
}

/** A form-and-result surface, such as running a tool. */
export function FormLoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <LoadingRegion label={label} className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
      <header className="mb-8 space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>
      <Card className="gap-5 p-6 shadow-none">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-28" />
      </Card>
    </LoadingRegion>
  );
}

import {
  ContentLoadingSkeleton,
  LoadingRegion,
  Skeleton,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export type AppSurfacePresentation =
  | { layout: "contained"; loading: "content" }
  | { layout: "workspace"; loading: "editor" | "studio" };

export function getAppSurfacePresentation(appId: string, subpath: string): AppSurfacePresentation {
  if (appId === "sites") {
    return { layout: "workspace", loading: "studio" };
  }

  if (appId === "notes" && subpath.split("/").some(Boolean)) {
    return { layout: "workspace", loading: "editor" };
  }

  return { layout: "contained", loading: "content" };
}

export function AppSurface({
  children,
  presentation,
}: {
  children: ReactNode;
  presentation: AppSurfacePresentation;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        presentation.layout === "contained"
          ? "container max-w-6xl p-4"
          : "h-full min-h-0 max-w-none overflow-hidden",
      )}
    >
      {children}
    </div>
  );
}

export function AppSurfaceLoading({
  label = "Loading app",
  presentation,
}: {
  label?: string;
  presentation: AppSurfacePresentation;
}) {
  if (presentation.loading === "content") {
    return <ContentLoadingSkeleton label={label} />;
  }

  if (presentation.loading === "editor") {
    return (
      <LoadingRegion label={label} className="flex h-full min-h-[28rem] flex-col bg-surface">
        <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-5 py-10 sm:px-10">
          <div className="mx-auto max-w-3xl space-y-5">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-8 h-56 w-full" />
          </div>
        </div>
      </LoadingRegion>
    );
  }

  return (
    <LoadingRegion
      label={label}
      className="grid h-full min-h-[28rem] grid-cols-1 bg-surface lg:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <div className="hidden min-h-0 border-r border-border p-4 lg:block">
        <Skeleton className="mb-5 h-4 w-28" />
        <Skeleton className="mb-3 h-7 w-44" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="size-8" />
          </div>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <Skeleton className="h-full min-h-64 w-full rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}

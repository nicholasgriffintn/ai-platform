import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteGenerationStatus } from "@ngriffin_uk/polychat-library-react";
import type { SiteKind, SitePlan } from "@ngriffin_uk/polychat-schemas";

const STATUS_COPY: Partial<Record<SiteGenerationStatus, string>> = {
  planning: "Reading the brief",
  selecting: "Preparing the right building blocks",
  starting: "Starting the model",
  reasoning: "Jev is reasoning through the build",
  streaming: "Building the first visible section",
  reviewing: "The site is ready while Jev checks it",
  repairing: "Applying a quality fix",
  saving: "Saving the latest version",
};

const APPLICATION_KINDS = new Set<SiteKind>(["app", "dashboard"]);

function Pulse({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

function MarketingWireframe() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between border-b border-border/70 px-5">
        <Pulse className="h-3 w-20" />
        <div className="flex gap-2">
          <Pulse className="h-2.5 w-12" />
          <Pulse className="h-2.5 w-12" />
          <Pulse className="h-7 w-16" />
        </div>
      </div>
      <div className="grid flex-1 items-center gap-8 px-8 py-10 md:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-9 w-full max-w-sm" />
          <Pulse className="h-9 w-4/5 max-w-xs" />
          <Pulse className="h-3 w-full max-w-md" />
          <Pulse className="h-3 w-3/4 max-w-sm" />
          <div className="mt-2 flex gap-2">
            <Pulse className="h-9 w-24" />
            <Pulse className="h-9 w-20" />
          </div>
        </div>
        <Pulse className="min-h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

function ApplicationWireframe() {
  return (
    <div className="grid h-full grid-cols-[8rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 border-r border-border/70 p-4">
        <Pulse className="mb-3 h-4 w-20" />
        <Pulse className="h-8 w-full" />
        <Pulse className="h-8 w-full" />
        <Pulse className="h-8 w-4/5" />
      </div>
      <div className="flex min-w-0 flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <Pulse className="h-6 w-32" />
          <Pulse className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Pulse className="h-20 w-full" />
          <Pulse className="h-20 w-full" />
          <Pulse className="h-20 w-full" />
        </div>
        <Pulse className="min-h-44 w-full flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function FormWireframe() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border/70 p-6">
        <Pulse className="h-7 w-2/3" />
        <Pulse className="h-3 w-full" />
        <Pulse className="mt-2 h-10 w-full" />
        <Pulse className="h-10 w-full" />
        <Pulse className="h-10 w-full" />
        <Pulse className="mt-2 h-10 w-28" />
      </div>
    </div>
  );
}

function DocsWireframe() {
  return (
    <div className="grid h-full grid-cols-[10rem_minmax(0,1fr)] gap-8 p-6">
      <div className="flex flex-col gap-3 border-r border-border/70 pr-6">
        <Pulse className="h-4 w-20" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-4/5" />
        <Pulse className="h-3 w-3/4" />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Pulse className="h-8 w-1/2" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-5/6" />
        <Pulse className="h-28 w-full rounded-lg" />
        <Pulse className="h-3 w-4/5" />
      </div>
    </div>
  );
}

function BuildWireframe({ kind }: { kind?: SiteKind }) {
  if (kind && APPLICATION_KINDS.has(kind)) {
    return <ApplicationWireframe />;
  }

  if (kind === "form" || kind === "component") {
    return <FormWireframe />;
  }

  if (kind === "docs") {
    return <DocsWireframe />;
  }

  return <MarketingWireframe />;
}

export function SiteBuildPlaceholder({
  status,
  plan,
  patchCount,
}: {
  status: SiteGenerationStatus;
  plan: SitePlan | null;
  patchCount: number;
}) {
  const statusCopy = STATUS_COPY[status] ?? "Preparing the preview";

  return (
    <div className="relative flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/40 p-4 sm:p-8">
      <div className="flex h-full max-h-[42rem] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-surface px-4">
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/10" />
          <span className="size-2 rounded-full bg-foreground/10" />
          <span className="ml-3 h-5 w-2/5 rounded-md bg-foreground/5" />
        </div>
        <div className="min-h-0 flex-1">
          <BuildWireframe kind={plan?.kind} />
        </div>
      </div>
      <output
        aria-live="polite"
        className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        {statusCopy}
        {patchCount > 0 ? ` · ${patchCount} updates` : ""}
      </output>
    </div>
  );
}

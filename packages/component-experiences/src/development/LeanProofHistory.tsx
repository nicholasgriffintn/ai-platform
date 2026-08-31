import { Badge, Card, Link } from "@ngriffin_uk/polychat-component-ui";
import type { LeanProofOutcome, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { ChevronRight, CircleDashed, FileCheck2 } from "lucide-react";

import { LeanProofOutcomeBadge } from "./LeanProofOutcomeBadge";
import { getLeanProofTaskStatusLabel } from "./presentation";

export interface LeanProofRunSummary {
  id: string;
  objective: string;
  targetPaths: string[];
  status: ProjectTaskStatus;
  outcome: LeanProofOutcome | null;
  updatedAt: string;
  href: string;
}

export function LeanProofHistory({
  runs,
  isLoading = false,
}: {
  runs: LeanProofRunSummary[];
  isLoading?: boolean;
}) {
  return (
    <section aria-labelledby="lean-proof-history-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-zinc-500 uppercase">
            Proof ledger
          </p>
          <h2 id="lean-proof-history-heading" className="mt-1 text-base font-semibold">
            Recent runs
          </h2>
        </div>
        <span className="text-xs text-zinc-500">
          {runs.length} run{runs.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <Card className="flex items-center gap-3 p-5 shadow-none">
          <CircleDashed size={17} className="animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500">Loading proof runs…</p>
        </Card>
      ) : runs.length === 0 ? (
        <Card className="border-dashed p-6 text-center shadow-none">
          <FileCheck2 className="mx-auto text-zinc-400" size={22} />
          <p className="mt-2 text-sm font-medium">No proof runs yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Your verified and incomplete attempts appear here.
          </p>
        </Card>
      ) : (
        <ol className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={run.href}
                className="group flex items-start gap-4 bg-white p-4 no-underline transition-colors hover:bg-zinc-50 hover:!no-underline dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <span className="mt-0.5 rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <FileCheck2 size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-zinc-950 dark:text-white">
                      {run.objective}
                    </p>
                    {run.outcome ? (
                      <LeanProofOutcomeBadge outcome={run.outcome} />
                    ) : (
                      <Badge variant="outline">{getLeanProofTaskStatusLabel(run.status)}</Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                    {run.targetPaths.join(" · ")}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {formatRelativeTime(run.updatedAt)}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="mt-2 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

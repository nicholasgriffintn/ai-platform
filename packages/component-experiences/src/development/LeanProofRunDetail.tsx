import { Badge, Button, ButtonLink, Card } from "@ngriffin_uk/polychat-component-ui";
import type { Goal, LeanProofResult, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { Check, Loader2, RotateCcw } from "lucide-react";

import { LeanProofResultView } from "./LeanProofResultView";
import { getLeanProofTaskStatusLabel } from "./presentation";

export interface LeanProofRunDetailProps {
  task: ProjectTask;
  goal: Goal | null;
  result: LeanProofResult | null;
  outputHref: string | null;
  isRetrying?: boolean;
  isReviewing?: boolean;
  onRetry: () => void;
  onApprove: () => void;
}

export function LeanProofRunDetail({
  task,
  goal,
  result,
  outputHref,
  isRetrying = false,
  isReviewing = false,
  onRetry,
  onApprove,
}: LeanProofRunDetailProps) {
  const request = task.runner?.kind === "sandbox" ? task.runner.request : null;
  const canRetry =
    task.status === "blocked" &&
    ["dispatch_failed", "run_failed", "verification_failed"].includes(task.blockedReason ?? "");

  return (
    <div className="space-y-5">
      <Card className="p-5 shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{getLeanProofTaskStatusLabel(task.status)}</Badge>
              {task.status === "running" || task.status === "queued" ? (
                <span className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
                  <Loader2 size={13} className="animate-spin" /> Live
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-zinc-950 dark:text-white">
              {task.objective}
            </h2>
            {request ? (
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {request.targetPaths.join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canRetry ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={13} />}
                isLoading={isRetrying}
                onClick={onRetry}
              >
                Retry proof
              </Button>
            ) : null}
            {task.status === "review" ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={13} />}
                isLoading={isReviewing}
                onClick={onApprove}
              >
                Approve result
              </Button>
            ) : null}
            {outputHref ? (
              <ButtonLink href={outputHref} variant="outline" size="sm">
                Open saved output
              </ButtonLink>
            ) : null}
          </div>
        </div>

        {task.blockedDetail ? (
          <p
            role="alert"
            className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {task.blockedDetail}
          </p>
        ) : null}

        {goal && !result ? (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
              <span>{goal.iteration_count} agent iterations</span>
              <span>{goal.tokens_spent.toLocaleString()} tokens</span>
            </div>
            {goal.progress.at(-1) ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {goal.progress.at(-1)?.summary}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">The proof environment is starting…</p>
            )}
          </div>
        ) : null}
      </Card>

      {result ? (
        <LeanProofResultView result={result} />
      ) : task.status === "queued" || task.status === "running" ? (
        <Card className="flex items-center gap-3 border-dashed p-5 shadow-none">
          <Loader2 size={17} className="animate-spin text-blue-500" />
          <div>
            <p className="text-sm font-medium">Lean is checking the proof</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              This page refreshes while the sandbox works.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed p-5 shadow-none">
          <p className="text-sm text-zinc-500">No structured proof result was recorded.</p>
        </Card>
      )}
    </div>
  );
}

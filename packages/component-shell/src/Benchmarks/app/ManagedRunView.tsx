import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  useBenchmarkRun,
  useCancelBenchmarkRun,
  useDeleteBenchmarkRun,
  useRetryBenchmarkRun,
  useShareBenchmarkRun,
} from "@ngriffin_uk/polychat-library-react";
import { isActiveBenchmarkRunStatus } from "@ngriffin_uk/polychat-schemas";
import { Link2, Link2Off, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

import { benchmarkPaths } from "../benchmark-display.js";
import { RunDetailView } from "../RunDetailView.js";

function shareUrl(token: string): string {
  return typeof window === "undefined"
    ? benchmarkPaths.shared(token)
    : new URL(benchmarkPaths.shared(token), window.location.origin).toString();
}

export function ManagedRunView({ runId, onDeleted }: { runId: string; onDeleted: () => void }) {
  const query = useBenchmarkRun(runId);
  const share = useShareBenchmarkRun();
  const remove = useDeleteBenchmarkRun();
  const cancel = useCancelBenchmarkRun();
  const retry = useRetryBenchmarkRun();
  const [copied, setCopied] = useState(false);

  if (query.isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading run" />;
  }

  if (!query.data) {
    return <EmptyState title="Run not found" message="It may have been deleted." />;
  }

  const { run, benchmark, items } = query.data;
  const isShared = run.visibility !== "private" && run.shareToken;
  const isActive = isActiveBenchmarkRunStatus(run.status);
  const canRetry =
    run.status === "failed" ||
    run.status === "cancelled" ||
    (run.status === "completed" && items.some((item) => item.result?.error));
  const failedChecks =
    run.status === "completed" &&
    benchmark.scoring === "votes" &&
    items.filter((item) => item.result && !item.result.error && !item.result.artefact).length;
  const newItems = run.status === "completed" ? benchmark.itemCount - run.itemsTotal : 0;
  const error = cancel.error ?? retry.error ?? share.error ?? remove.error;

  const copy = async () => {
    if (run.shareToken) {
      await navigator.clipboard.writeText(shareUrl(run.shareToken));
      setCopied(true);
    }
  };

  const actions = (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {isActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<X size={14} />}
            disabled={cancel.isPending}
            isLoading={cancel.isPending}
            onClick={() => cancel.mutate(runId)}
          >
            Cancel run
          </Button>
        ) : null}
        {canRetry ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={retry.isPending}
            isLoading={retry.isPending}
            onClick={() => retry.mutate({ runId })}
          >
            Retry missing items
          </Button>
        ) : null}
        {newItems > 0 ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={retry.isPending}
            isLoading={retry.isPending}
            onClick={() => retry.mutate({ runId })}
          >
            Answer {newItems} new {newItems === 1 ? "item" : "items"}
          </Button>
        ) : null}
        {failedChecks ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={retry.isPending}
            isLoading={retry.isPending}
            onClick={() => retry.mutate({ runId, failedChecks: true })}
          >
            Retry {failedChecks} failed {failedChecks === 1 ? "check" : "checks"}
          </Button>
        ) : null}
        {run.scope === "official" ? null : isShared ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Link2 size={14} />}
              onClick={() => void copy()}
            >
              {copied ? "Link copied" : "Copy share link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<Link2Off size={14} />}
              disabled={share.isPending}
              onClick={() => share.mutate({ runId, visibility: "private" })}
            >
              Stop sharing
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Link2 size={14} />}
            disabled={share.isPending || run.status !== "completed"}
            onClick={() => share.mutate({ runId, visibility: "link" })}
          >
            Share by link
          </Button>
        )}
        {isActive ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            disabled={remove.isPending}
            onClick={() => remove.mutate(runId, { onSuccess: onDeleted })}
          >
            Delete
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-failure">{error.message}</p> : null}
    </div>
  );

  return <RunDetailView detail={query.data} actions={actions} embedded />;
}

import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  useBenchmarkRun,
  useDeleteBenchmarkRun,
  useShareBenchmarkRun,
} from "@ngriffin_uk/polychat-library-react";
import { Link2, Link2Off, Trash2 } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  if (query.isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading run" />;
  }

  if (!query.data) {
    return <EmptyState title="Run not found" message="It may have been deleted." />;
  }

  const { run } = query.data;
  const isShared = run.visibility !== "private" && run.shareToken;

  const copy = async () => {
    if (run.shareToken) {
      await navigator.clipboard.writeText(shareUrl(run.shareToken));
      setCopied(true);
    }
  };

  const actions =
    run.scope === "official" ? null : (
      <div className="flex flex-wrap gap-2">
        {isShared ? (
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
      </div>
    );

  return <RunDetailView detail={query.data} actions={actions} embedded />;
}

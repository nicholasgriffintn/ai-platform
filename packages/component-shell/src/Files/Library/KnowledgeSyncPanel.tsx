import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeSyncs,
  useKnowledgeSyncControl,
  type KnowledgeSyncTarget,
} from "@ngriffin_uk/polychat-library-react";

export function KnowledgeSyncPanel({ target }: { target: KnowledgeSyncTarget }) {
  const query = useKnowledgeSyncs(target);
  const control = useKnowledgeSyncControl(target);

  if (!query.data?.length && !query.error) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-medium">Connected knowledge</h2>
        <p className="text-xs text-muted-foreground">
          {"projectId" in target
            ? "Synced from your connections and shared with project members. Search catches up after indexing."
            : "Synced from your connections into this notebook as sources. New items arrive on each sync."}
        </p>
      </div>
      {query.error || control.error ? (
        <p role="alert" className="text-sm text-failure">
          Could not load or update the sync.
        </p>
      ) : null}
      {query.data?.map((sync) => (
        <div key={sync.id} className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">
            {sync.title} · {sync.status}
          </p>
          <p className="text-xs text-muted-foreground">
            {sync.resourceCount} resources · every {sync.intervalMinutes} minutes · last complete
            sync: {sync.lastSuccessfulAt ?? "pending"}
          </p>
          {sync.lastError ? (
            <output className="block text-xs text-failure">{sync.lastError}</output>
          ) : null}
          {sync.canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={control.isPending}
                onClick={() =>
                  control.mutate({
                    id: sync.id,
                    action: sync.status === "active" ? "pause" : "resume",
                  })
                }
              >
                {sync.status === "active" ? "Pause" : "Resume"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={control.isPending}
                onClick={() => control.mutate({ id: sync.id, action: "refresh" })}
              >
                Refresh now
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

import { Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  RepositoryKnowledgeSync,
  RepositoryKnowledgeSyncControl,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";

interface KnowledgeConnectionListProps {
  syncs: RepositoryKnowledgeSync[];
  userId?: number;
  isPending: boolean;
  onControl: (id: string, input: RepositoryKnowledgeSyncControl) => void;
  onDisconnect: (id: string) => void;
}

export function KnowledgeConnectionList({
  syncs,
  userId,
  isPending,
  onControl,
  onDisconnect,
}: KnowledgeConnectionListProps) {
  if (!syncs.length) {
    return (
      <EmptyState
        title="No connected knowledge"
        message="Sync a documentation folder to make current repository material searchable."
      />
    );
  }

  return (
    <div className="space-y-3">
      {syncs.map((sync) => (
        <div key={sync.id} className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium">
            {sync.repository} · {sync.path || "Repository root"}
          </p>
          <p className="text-xs text-muted-foreground">
            {sync.branch} · {sync.status} · {sync.documentCount} documents ·{" "}
            {sync.lastSyncedAt
              ? "Updated " + formatDate(sync.lastSyncedAt)
              : "Waiting for first sync"}
          </p>
          {sync.errorMessage ? (
            <output className="mt-2 block text-sm text-muted-foreground">
              {sync.errorMessage}
            </output>
          ) : null}
          {sync.createdByUserId === userId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  onControl(sync.id, {
                    revision: sync.revision,
                    action:
                      sync.status === "paused" || sync.status === "blocked" ? "resume" : "sync",
                  })
                }
              >
                {sync.status === "paused" || sync.status === "blocked" ? "Resume" : "Sync now"}
              </Button>
              {sync.status !== "paused" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onControl(sync.id, { revision: sync.revision, action: "pause" })}
                >
                  Pause
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => onDisconnect(sync.id)}
              >
                Disconnect
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

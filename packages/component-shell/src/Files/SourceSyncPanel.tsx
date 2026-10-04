import { Button, Card, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  useSourceSyncMutations,
  useSourceSyncs,
  useProject,
  useWorkspace,
} from "@ngriffin_uk/polychat-library-react";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

import { SourceSyncForm } from "./SourceSyncForm.js";

export function SourceSyncPanel({ projectId }: { projectId?: string }) {
  const syncs = useSourceSyncs(projectId);
  const mutations = useSourceSyncMutations();
  const project = useProject(projectId);
  const workspace = useWorkspace(project.data?.workspaceId);
  const canManage =
    !projectId || workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <>
      <Card className="mb-6 space-y-4 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Synced knowledge</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep connected sources searchable. Changes and access are checked every 15 minutes.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!canManage}
            onClick={() => {
              setOpen(true);
            }}
          >
            Add knowledge source
          </Button>
        </div>
        {syncs.error ? (
          <p role="alert" className="text-sm text-destructive">
            {syncs.error.message}
          </p>
        ) : null}
        {syncs.data?.map((sync) => (
          <div
            key={sync.id}
            className="flex items-start justify-between gap-3 border-t border-border pt-3"
          >
            <div>
              <h3 className="text-sm font-medium">{sync.title}</h3>
              <p className="text-xs text-muted-foreground">
                {sync.status} · {sync.documentCount} documents
                {sync.lastSyncedAt ? ` · Last synced ${formatDate(sync.lastSyncedAt)}` : ""}
              </p>
              {sync.error ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {sync.error}
                </p>
              ) : null}
            </div>
            {canManage ? (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={mutations.update.isPending}
                  onClick={() =>
                    mutations.update.mutate(
                      {
                        syncId: sync.id,
                        enabled: sync.status === "paused" || sync.status === "failed",
                      },
                      { onError: (failure) => toast.error(failure.message) },
                    )
                  }
                >
                  {sync.status === "paused"
                    ? "Resume"
                    : sync.status === "failed"
                      ? "Retry"
                      : "Pause"}
                </Button>
                <Button variant="secondary" onClick={() => setDeleteId(sync.id)}>
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </Card>
      <SourceSyncForm
        key={`${projectId ?? "personal"}-${open}`}
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
      />
      <ConfirmationDialog
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) {
            setDeleteId(null);
          }
        }}
        title="Remove knowledge sync"
        description="Stop syncing and remove these documents from search and project context."
        confirmText="Remove sync"
        variant="destructive"
        isLoading={mutations.remove.isPending}
        onConfirm={async () => {
          try {
            if (deleteId) {
              await mutations.remove.mutateAsync(deleteId);
            }

            setDeleteId(null);
          } catch (failure) {
            toast.error(
              failure instanceof Error ? failure.message : "Could not remove the source.",
            );
          }
        }}
      />
    </>
  );
}

import {
  Button,
  Card,
  ConfirmationDialog,
  FormDialog,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useRecipeConnectorAccounts,
  useSourceSyncMutations,
  useSourceSyncs,
  useProject,
  useWorkspace,
} from "@ngriffin_uk/polychat-library-react";
import { formatDate, readGoogleDriveFolderId } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export function SourceSyncPanel({ projectId }: { projectId?: string }) {
  const syncs = useSourceSyncs(projectId);
  const accounts = useRecipeConnectorAccounts("googledrive");
  const mutations = useSourceSyncMutations();
  const project = useProject(projectId);
  const workspace = useWorkspace(project.data?.workspaceId);
  const canManage =
    !projectId || workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [folder, setFolder] = useState("");
  const [title, setTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeAccounts = (accounts.data?.accounts ?? []).filter(
    (account) => account.status === "ACTIVE" && !account.isDisabled,
  );

  return (
    <>
      <Card className="mb-6 space-y-4 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Synced knowledge</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep selected Drive folders searchable. Changes and access are checked every 15
              minutes.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!canManage}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            Add Drive folder
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
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Sync a Drive folder"
        submitText="Start syncing"
        isLoading={mutations.create.isPending}
        onSubmit={async () => {
          const rootId = readGoogleDriveFolderId(folder);

          if (!rootId || !accountId || !title.trim()) {
            setError("Choose an account, name the folder and paste its Drive link.");

            return;
          }

          try {
            await mutations.create.mutateAsync({
              projectId,
              provider: "googledrive",
              accountId,
              rootId,
              title,
            });
            setOpen(false);
            setTitle("");
            setFolder("");
            toast.success("Folder sync added");
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Could not add this folder.");
          }
        }}
      >
        <div className="space-y-4">
          <FormSelect
            label="Connected Drive account"
            value={accountId}
            onValueChange={setAccountId}
            options={activeAccounts.map((account) => ({
              value: account.id,
              label: account.alias ?? "Google Drive account",
            }))}
          />
          {!activeAccounts.length ? (
            <p className="text-sm text-muted-foreground">Connect Google Drive in Plugins first.</p>
          ) : null}
          <FormInput
            label="Folder name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
          <FormInput
            label="Drive folder link"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Google Docs and text files are included, along with subfolders.
            {projectId
              ? " A document appears in this project only when its direct permissions cover every current member. Group-only sharing is excluded."
              : " Sources stay in your personal knowledge."}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </FormDialog>
      <ConfirmationDialog
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) {
            setDeleteId(null);
          }
        }}
        title="Remove folder sync"
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
              failure instanceof Error ? failure.message : "Could not remove the folder.",
            );
          }
        }}
      />
    </>
  );
}

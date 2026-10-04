import {
  IntegrationAccountForm,
  IntegrationReviewPanel,
  IntegrationToolReview,
  OperationGrantForm,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useNativeIntegrationActions } from "@ngriffin_uk/polychat-library-react";
import { integrationGrantSchema, type IntegrationDefinition } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";

export function NativeIntegrationDetails({
  definition,
  scope,
  onClose,
}: {
  definition: IntegrationDefinition;
  scope: CapabilityLibraryScope;
  onClose: () => void;
}) {
  const actions = useNativeIntegrationActions();
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const capability = scope.capabilities.find(
    (candidate) => candidate.kind === "integration" && candidate.capabilityId === definition.id,
  );
  const grant = integrationGrantSchema.safeParse(capability?.configuration);
  const review = actions.review.data;
  const definitionError = actions.review.error ?? actions.refresh.error ?? actions.revoke.error;

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        width="min(640px, calc(100vw - 2rem))"
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle>{definition.name}</DialogTitle>
          <DialogDescription>
            {definition.description || "A custom MCP integration."}
          </DialogDescription>
          <p className="text-xs break-all text-muted-foreground">{definition.snapshot.endpoint}</p>
          <p className="text-xs text-muted-foreground">
            Definition revision {definition.revision} · Every custom action requires approval.
          </p>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Review saved actions ({definition.snapshot.tools.length})
            </summary>
            <div className="mt-3 space-y-2">
              {definition.snapshot.tools.map((tool) => (
                <IntegrationToolReview key={tool.name} reviewed={tool} />
              ))}
            </div>
          </details>
          <IntegrationAccountForm
            connected={definition.connected}
            requiresToken={definition.snapshot.authentication === "bearer"}
            isSaving={actions.connect.isPending || actions.disconnect.isPending}
            error={(actions.connect.error ?? actions.disconnect.error)?.message}
            onConnect={async (token) => {
              await actions.connect.mutateAsync({ id: definition.id, token });
              actions.connect.reset();
            }}
            onDisconnect={() => actions.disconnect.mutate(definition.id)}
          />
          {scope.requiresExplicitEnablement && (
            <>
              {grant.success && grant.data.revision !== definition.revision && (
                <p className="text-sm text-muted-foreground">
                  This project uses revision {grant.data.revision}. Saving access below reviews and
                  upgrades it to revision {definition.revision}.
                </p>
              )}
              <OperationGrantForm
                key={`${definition.revision}:${JSON.stringify(grant.success ? grant.data : null)}`}
                operations={definition.snapshot.tools.map((tool) => ({
                  id: tool.name,
                  description: tool.description ?? "Custom action · approval required",
                }))}
                initialOperations={grant.success ? grant.data.operations : []}
                canManage={scope.canManage}
                isSaving={
                  scope.projectMutations.add.isPending || scope.projectMutations.remove.isPending
                }
                error={
                  (scope.projectMutations.add.error ?? scope.projectMutations.remove.error)?.message
                }
                onSave={(operations) => {
                  void scope
                    .add({
                      kind: "integration",
                      capabilityId: definition.id,
                      configuration: { revision: definition.revision, operations },
                    })
                    .catch(() => undefined);
                }}
                onRevoke={capability ? () => scope.remove(capability) : undefined}
              />
            </>
          )}
          {definition.canManage && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!definition.connected || actions.review.isPending}
                  onClick={() => actions.review.mutate(definition.id)}
                >
                  {actions.review.isPending ? "Checking service…" : "Review service changes"}
                </Button>
                <Button type="button" variant="destructive" onClick={() => setConfirmRemoval(true)}>
                  Remove definition
                </Button>
              </div>
              {review && (
                <IntegrationReviewPanel
                  current={definition.snapshot}
                  reviewed={review.snapshot}
                  isSaving={actions.refresh.isPending}
                  onCancel={() => actions.review.reset()}
                  onSave={() =>
                    actions.refresh.mutate(
                      {
                        id: definition.id,
                        expectedRevision: review.currentRevision,
                        expectedDigest: review.snapshot.digest,
                      },
                      { onSuccess: () => actions.review.reset() },
                    )
                  }
                />
              )}
              {definitionError && (
                <p role="alert" className="text-sm text-failure">
                  {definitionError.message}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={confirmRemoval}
        onOpenChange={setConfirmRemoval}
        title="Remove integration definition"
        description="This revokes this definition in every project and removes its stored account credentials. Add a new definition to use the service again."
        confirmText="Remove definition"
        variant="destructive"
        isLoading={actions.revoke.isPending}
        onConfirm={() => actions.revoke.mutate(definition.id, { onSuccess: onClose })}
      />
    </>
  );
}

import { Checkbox } from "@ngriffin_uk/polychat-component-ui";
import {
  getErrorMessage,
  useRecipeInstallations,
  useUpdateRecipeInstallation,
} from "@ngriffin_uk/polychat-library-react";

export function TeammateRoutinesPanel({
  contextId,
  projectId,
}: {
  contextId: string;
  projectId?: string;
}) {
  const installations = useRecipeInstallations(projectId);
  const update = useUpdateRecipeInstallation();
  const items = installations.data?.installations ?? [];

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">Routines</p>
        <p className="text-xs text-muted-foreground">
          Scheduled and event runs use this teammate’s identity, brief and connection grants.
        </p>
      </div>

      {installations.error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(installations.error, "Could not load routines.")}
        </p>
      )}

      {!installations.isLoading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">No routines are installed in this scope.</p>
      )}

      <div className="space-y-2">
        {items.map((installation) => {
          const checked = installation.teammateContextId === contextId;
          const assignedElsewhere =
            Boolean(installation.teammateContextId) && installation.teammateContextId !== contextId;

          return (
            <label
              key={installation.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <Checkbox
                checked={checked}
                disabled={update.isPending || assignedElsewhere}
                onCheckedChange={(next) =>
                  update.mutate({
                    installationId: installation.id,
                    update: { teammateContextId: next === true ? contextId : null },
                  })
                }
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {installation.recipeId}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {assignedElsewhere
                    ? "Assigned to another teammate context"
                    : checked
                      ? "Runs as this teammate"
                      : "Runs as a generic recipe"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {update.error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(update.error, "Could not update the routine owner.")}
        </p>
      )}
    </div>
  );
}

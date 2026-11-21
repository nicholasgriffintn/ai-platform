import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  useRecipeInstallationSpend,
  useUpdateRecipeInstallation,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { SpendCapControl } from "./SpendCapControl.js";

export function RoutineSpendControl({
  installationId,
  onResumed,
}: {
  installationId: string;
  onResumed?: () => void;
}) {
  const spend = useRecipeInstallationSpend(installationId);
  const update = useUpdateRecipeInstallation();

  if (spend.error) {
    return (
      <p className="text-xs text-destructive">
        {getErrorMessage(spend.error, "Could not load this routine’s spend.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <SpendCapControl
        ledger={spend.data}
        isPending={update.isPending}
        onSave={(monthlyCreditCapMicros) =>
          update.mutate({ installationId, update: { monthlyCreditCapMicros } })
        }
      />
      {onResumed && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            !spend.data || spend.data.state === "reached" || spend.isFetching || update.isPending
          }
          onClick={() =>
            update.mutate(
              { installationId, update: { status: "active" } },
              { onSuccess: onResumed },
            )
          }
        >
          Resume Discover
        </Button>
      )}
      {update.error && (
        <p className="text-xs text-destructive">
          {getErrorMessage(update.error, "Could not update this routine.")}
        </p>
      )}
    </div>
  );
}

import {
  useRecipeInstallationSpend,
  useUpdateRecipeInstallation,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { SpendCapControl } from "./SpendCapControl.js";

export function RoutineSpendControl({ installationId }: { installationId: string }) {
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
    <SpendCapControl
      ledger={spend.data}
      isPending={update.isPending}
      onSave={(monthlyCreditCapMicros) =>
        update.mutate({ installationId, update: { monthlyCreditCapMicros } })
      }
    />
  );
}

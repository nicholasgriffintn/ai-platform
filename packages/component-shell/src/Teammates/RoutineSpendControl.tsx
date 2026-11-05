import {
  useRecipeInstallationSpend,
  useUpdateRecipeInstallation,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { RoutineRunCapControl } from "./RoutineRunCapControl.js";
import { SpendCapControl } from "./SpendCapControl.js";

export function RoutineSpendControl({
  installationId,
  runCreditCapMicros,
}: {
  installationId: string;
  runCreditCapMicros?: number | null;
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
    <div className="space-y-3">
      <SpendCapControl
        ledger={spend.data}
        isPending={update.isPending}
        onSave={(monthlyCreditCapMicros) =>
          update.mutate({ installationId, update: { monthlyCreditCapMicros } })
        }
      />
      {runCreditCapMicros !== undefined ? (
        <RoutineRunCapControl
          capCreditMicros={runCreditCapMicros}
          isPending={update.isPending}
          onSave={(capCreditMicros) =>
            update.mutate({ installationId, update: { runCreditCapMicros: capCreditMicros } })
          }
        />
      ) : null}
    </div>
  );
}

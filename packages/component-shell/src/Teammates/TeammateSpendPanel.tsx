import {
  useTeammateContextSpend,
  useUpdateTeammateContextBudget,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { SpendCapControl } from "./SpendCapControl.js";

export function TeammateSpendPanel({ contextId }: { contextId: string }) {
  const spend = useTeammateContextSpend(contextId);
  const updateBudget = useUpdateTeammateContextBudget();

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Spend</p>
        <p className="text-xs text-muted-foreground">
          Credits used by every run under this context, including its routines. A cap stops new runs
          for the rest of the month once it is reached.
        </p>
      </div>

      {spend.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(spend.error, "Could not load this teammate’s spend.")}
        </p>
      ) : (
        <SpendCapControl
          ledger={spend.data}
          isPending={updateBudget.isPending}
          onSave={(monthlyCreditCapMicros) =>
            updateBudget.mutate({ contextId, monthlyCreditCapMicros })
          }
        />
      )}

      {updateBudget.error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(updateBudget.error, "Could not save the monthly cap.")}
        </p>
      )}
    </div>
  );
}

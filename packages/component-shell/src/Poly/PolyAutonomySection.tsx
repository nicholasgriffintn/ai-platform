import { Button, FormRadioGroup } from "@ngriffin_uk/polychat-component-ui";
import {
  TEAMMATE_AUTONOMY_COPY,
  usePolyStandingApprovals,
  useSetPolyAutonomy,
} from "@ngriffin_uk/polychat-library-react";
import { TEAMMATE_AUTONOMY_LEVELS, type PolyAgenda } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

import { PolyMonthReport } from "./PolyMonthReport.js";

const AUTONOMY_OPTIONS = TEAMMATE_AUTONOMY_LEVELS.map((level) => ({
  value: level,
  ...TEAMMATE_AUTONOMY_COPY[level],
}));

export function PolyAutonomySection({ agenda }: { agenda: PolyAgenda }) {
  const setAutonomy = useSetPolyAutonomy(agenda);
  const { revoke } = usePolyStandingApprovals();

  return (
    <div className="space-y-3">
      <FormRadioGroup
        legend="How much Poly does alone"
        description="Sending, spending, deleting, credentials and exports always ask."
        name="poly_autonomy"
        value={agenda.autonomy_level}
        options={AUTONOMY_OPTIONS}
        disabled={setAutonomy.isPending}
        onValueChange={(level) =>
          setAutonomy.mutate(level, {
            onError: (error) =>
              toast.error(getErrorMessage(error, "Poly could not change how much it does alone")),
          })
        }
      />
      {agenda.standing_approvals.length > 0 ? (
        <ul className="space-y-1">
          {agenda.standing_approvals.map((approval) => (
            <li
              key={`${approval.toolName}:${approval.destination}`}
              className="flex items-center gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                Always allowed: <span className="font-mono text-xs">{approval.toolName}</span> on{" "}
                {approval.destination}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(approval)}
              >
                Stop allowing
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <PolyMonthReport />
    </div>
  );
}

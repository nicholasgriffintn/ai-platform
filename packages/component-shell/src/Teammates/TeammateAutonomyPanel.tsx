import { Button, FormRadioGroup } from "@ngriffin_uk/polychat-component-ui";
import { TEAMMATE_AUTONOMY_COPY, useTeammateAutonomy } from "@ngriffin_uk/polychat-library-react";
import {
  TEAMMATE_AUTONOMY_LEVELS,
  type TeammateAutonomyLevel,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

const AUTONOMY_OPTIONS = TEAMMATE_AUTONOMY_LEVELS.map((level) => ({
  value: level,
  ...TEAMMATE_AUTONOMY_COPY[level],
}));

const UNSET_AUTONOMY_LEVEL: TeammateAutonomyLevel = "partner";

export function TeammateAutonomyPanel({ context }: { context: TeammateContext }) {
  const { setLevel, revokeStanding } = useTeammateAutonomy(context);
  const [now] = useState(() => Date.now());
  const standingApprovals = context.standingApprovals.filter(
    (approval) => Date.parse(approval.expiresAt) > now,
  );

  return (
    <div className="space-y-3">
      <FormRadioGroup
        legend="How much this teammate does alone"
        description="Sending, spending, deleting, credentials and exports always ask."
        name={`teammate_autonomy_${context.id}`}
        value={context.autonomyLevel ?? UNSET_AUTONOMY_LEVEL}
        options={AUTONOMY_OPTIONS}
        disabled={setLevel.isPending}
        onValueChange={(level) =>
          setLevel.mutate(level, {
            onError: (error) =>
              toast.error(getErrorMessage(error, "Could not change how much it does alone")),
          })
        }
      />
      {standingApprovals.length > 0 ? (
        <ul className="space-y-1">
          {standingApprovals.map((approval) => (
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
                disabled={revokeStanding.isPending}
                onClick={() => revokeStanding.mutate(approval)}
              >
                Stop allowing
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

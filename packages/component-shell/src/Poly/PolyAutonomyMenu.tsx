import {
  Button,
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuRadioGroup,
  OptionsMenuSeparator,
  type OptionsMenuOption,
} from "@ngriffin_uk/polychat-component-ui";
import {
  usePolyHome,
  usePolyStandingApprovals,
  useSetPolyAutonomy,
} from "@ngriffin_uk/polychat-library-react";
import type { TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";
import { ShieldCheck } from "lucide-react";

const AUTONOMY_OPTIONS: readonly OptionsMenuOption<TeammateAutonomyLevel>[] = [
  { value: "observer", label: "Observer · reads and drafts only" },
  { value: "assistant", label: "Assistant · asks before it writes" },
  { value: "partner", label: "Partner · writes within its grants" },
];

const AUTONOMY_LABELS: Readonly<Record<TeammateAutonomyLevel, string>> = {
  observer: "Observer",
  assistant: "Assistant",
  partner: "Partner",
};

export function PolyAutonomyMenu() {
  const home = usePolyHome(true);
  const setAutonomy = useSetPolyAutonomy(home.data);
  const { revoke } = usePolyStandingApprovals();

  if (!home.data) {
    return null;
  }

  return (
    <OptionsMenu
      align="end"
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          icon={<ShieldCheck size={15} />}
          disabled={setAutonomy.isPending}
          aria-label={`What Poly may do on its own: ${AUTONOMY_LABELS[home.data.autonomy_level]}`}
        >
          {AUTONOMY_LABELS[home.data.autonomy_level]}
        </Button>
      }
    >
      <OptionsMenuRadioGroup
        value={home.data.autonomy_level}
        options={AUTONOMY_OPTIONS}
        onChange={(level) => setAutonomy.mutate(level)}
      />
      {home.data.standing_approvals.length > 0 ? (
        <>
          <OptionsMenuSeparator />
          {home.data.standing_approvals.map((approval) => (
            <OptionsMenuAction
              key={`${approval.toolName}:${approval.destination}`}
              keepOpen
              disabled={revoke.isPending}
              onSelect={() => revoke.mutate(approval)}
            >
              <span className="min-w-0 truncate">
                Stop allowing {approval.toolName} on {approval.destination}
              </span>
            </OptionsMenuAction>
          ))}
        </>
      ) : null}
    </OptionsMenu>
  );
}

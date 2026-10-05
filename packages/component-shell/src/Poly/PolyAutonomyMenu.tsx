import {
  Button,
  OptionsMenu,
  OptionsMenuRadioGroup,
  type OptionsMenuOption,
} from "@ngriffin_uk/polychat-component-ui";
import { usePolyHome, useSetPolyAutonomy } from "@ngriffin_uk/polychat-library-react";
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
    </OptionsMenu>
  );
}

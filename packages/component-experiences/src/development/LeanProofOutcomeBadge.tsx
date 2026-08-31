import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { LeanProofOutcome } from "@ngriffin_uk/polychat-schemas";
import { CheckCircle2, CircleAlert, CircleDashed, ShieldCheck } from "lucide-react";

import { getLeanProofOutcomePresentation } from "./presentation";

const BADGE_VARIANT = {
  success: "success",
  info: "outline",
  warning: "warning",
  danger: "destructive",
  neutral: "outline",
} as const;

export function LeanProofOutcomeBadge({ outcome }: { outcome: LeanProofOutcome }) {
  const presentation = getLeanProofOutcomePresentation(outcome);
  const Icon =
    outcome === "kernel_checked"
      ? ShieldCheck
      : outcome === "compiled"
        ? CheckCircle2
        : outcome === "incomplete"
          ? CircleDashed
          : CircleAlert;

  return (
    <Badge variant={BADGE_VARIANT[presentation.tone]}>
      <Icon size={13} aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}

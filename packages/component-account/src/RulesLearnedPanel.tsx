import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { Correction } from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { GraduationCap } from "lucide-react";

export interface RulesLearnedPanelProps {
  corrections: readonly Correction[];
  isLoading: boolean;
  dismissingId?: string;
  onDismiss: (correctionId: string) => void;
}

function placementLabel(correction: Correction): string {
  if (correction.placement === "skill") {
    return correction.placementRef ? `In the ${correction.placementRef} skill` : "In a skill";
  }

  if (correction.placement === "policy") {
    return "In how Poly decides";
  }

  return "In memory";
}

export function RulesLearnedPanel({
  corrections,
  isLoading,
  dismissingId,
  onDismiss,
}: RulesLearnedPanelProps) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-5">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap size={18} className="text-muted-foreground" />
          Rules learned
        </CardTitle>
        <CardDescription className="mt-1">
          What teammates took away when you corrected them. A rule that keeps coming back is one
          that is not sticking.
        </CardDescription>
      </CardHeader>

      <CardContent className="py-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rules…</p>
        ) : corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Correct a teammate and the rule it learns appears here.
          </p>
        ) : (
          <ul className="divide-y">
            {corrections.map((correction) => (
              <li key={correction.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium break-words text-foreground">
                    {correction.pattern}
                  </p>
                  <p className="text-xs break-words text-muted-foreground">
                    {correction.placement === "policy"
                      ? correction.quote
                      : `You said: “${correction.quote}”`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {placementLabel(correction)} · {formatDate(correction.createdAt)}
                    {correction.recurrences > 0
                      ? ` · came up ${correction.recurrences + 1} times`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  isLoading={dismissingId === correction.id}
                  onClick={() => onDismiss(correction.id)}
                >
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

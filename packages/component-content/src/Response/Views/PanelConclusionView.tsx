import { Badge, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  councilDecisionOptionSchema,
  councilDecisionResultSchema,
} from "@ngriffin_uk/polychat-schemas";

import { MemoizedMarkdown } from "../../markdown";

interface PanelConclusionData {
  conclusion?: string;
  models?: string[];
  stoppedReason?: string;
  turns?: unknown[];
  decision?: unknown;
  decisionOptions?: unknown;
}

function readConclusionData(data: unknown): PanelConclusionData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return data;
}

export function PanelConclusionView({
  data,
  embedded,
  heading,
}: {
  data: unknown;
  embedded: boolean;
  heading: string;
}) {
  const conclusion = readConclusionData(data);

  if (!conclusion.conclusion) {
    return null;
  }

  const turnCount = Array.isArray(conclusion.turns) ? conclusion.turns.length : undefined;
  const parsedDecision = councilDecisionResultSchema.safeParse(conclusion.decision);
  const parsedOptions = councilDecisionOptionSchema.array().safeParse(conclusion.decisionOptions);
  const decision = parsedDecision.success ? parsedDecision.data : undefined;
  const decisionOptions = parsedOptions.success ? parsedOptions.data : [];
  const evaluatedDecision = decision?.status === "evaluated" ? decision : undefined;
  const selectedOption =
    evaluatedDecision && typeof evaluatedDecision.optionId === "string"
      ? decisionOptions.find((option) => option.id === evaluatedDecision.optionId)
      : undefined;

  return (
    <div className={cn("space-y-1.5", embedded ? "" : "my-2")}>
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{heading}</span>
        {turnCount !== undefined && <span>{turnCount} turns</span>}
        {conclusion.models && conclusion.models.length > 0 && (
          <span className="font-mono">{conclusion.models.join(", ")}</span>
        )}
        {conclusion.stoppedReason && <span>{conclusion.stoppedReason}</span>}
      </div>
      {selectedOption?.label && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm">
          <Badge variant="success">Recommendation</Badge>
          <span className="font-medium text-foreground">{selectedOption.label}</span>
          {evaluatedDecision && Number.isFinite(evaluatedDecision.confidence) && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(evaluatedDecision.confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}
      <MemoizedMarkdown className="max-w-none text-sm">{conclusion.conclusion}</MemoizedMarkdown>
    </div>
  );
}

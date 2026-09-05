import { cn } from "@ngriffin_uk/polychat-component-ui";

import { MemoizedMarkdown } from "../../markdown";

interface PanelConclusionData {
  conclusion?: string;
  models?: string[];
  stoppedReason?: string;
  turns?: unknown[];
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
      <MemoizedMarkdown className="max-w-none text-sm">{conclusion.conclusion}</MemoizedMarkdown>
    </div>
  );
}

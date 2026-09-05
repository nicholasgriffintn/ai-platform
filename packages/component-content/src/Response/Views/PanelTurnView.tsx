import { cn } from "@ngriffin_uk/polychat-component-ui";

import { MemoizedMarkdown } from "../../markdown";

interface PanelTurnData {
  memberName?: string;
  memberRole?: string;
  model?: string;
  turn?: number;
  content?: string;
}

function isPanelTurnData(data: unknown): data is PanelTurnData {
  return Boolean(data) && typeof data === "object" && !Array.isArray(data);
}

export function PanelTurnView({
  data,
  embedded,
  fallbackName = "Panel member",
}: {
  data: unknown;
  embedded: boolean;
  fallbackName?: string;
}) {
  if (!isPanelTurnData(data) || !data.content) {
    return null;
  }

  return (
    <div className={cn("space-y-1", embedded ? "" : "my-2")}>
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{data.memberName ?? fallbackName}</span>
        {data.memberRole && <span>{data.memberRole}</span>}
        {data.model && <span className="font-mono">{data.model}</span>}
        {typeof data.turn === "number" && <span>Turn {data.turn}</span>}
      </div>
      <MemoizedMarkdown className="max-w-none text-sm text-foreground">
        {data.content}
      </MemoizedMarkdown>
    </div>
  );
}

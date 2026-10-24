import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { FileText } from "lucide-react";

import { OpenFileButton } from "./OpenFileButton.js";

export function DocumentOutputMessageView({
  data,
  toolName,
  onToolInteraction,
}: {
  data: unknown;
  toolName?: string;
  onToolInteraction?: ToolInteractionHandler;
}) {
  if (!isRecord(data) || typeof data.outputId !== "string" || typeof data.title !== "string") {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{data.title}</span>
        <span className="text-xs text-muted-foreground">
          {typeof data.revision === "number" && data.revision > 1
            ? `Document · revision ${data.revision}`
            : "Document"}
        </span>
      </div>
      <OpenFileButton
        toolName={toolName ?? "write_document"}
        outputId={data.outputId}
        onToolInteraction={onToolInteraction}
      />
    </div>
  );
}

import {
  type ToolInteractionHandler,
  WorkOutputView,
} from "@ngriffin_uk/polychat-component-content";
import { DECK_OUTPUT_KIND } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { Presentation, Table } from "lucide-react";

import { OpenFileButton } from "./OpenFileButton.js";

export function WorkOutputMessageView({
  data,
  toolName,
  onToolInteraction,
}: {
  data: unknown;
  toolName?: string;
  onToolInteraction?: ToolInteractionHandler;
}) {
  if (!isRecord(data) || typeof data.kind !== "string" || typeof data.title !== "string") {
    return null;
  }

  const Icon = data.kind === DECK_OUTPUT_KIND ? Presentation : Table;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <span>{data.title}</span>
        {typeof data.revision === "number" && data.revision > 1 ? (
          <span className="text-xs font-normal text-muted-foreground">
            revision {data.revision}
          </span>
        ) : null}
        {typeof data.outputId === "string" ? (
          <span className="ml-auto">
            <OpenFileButton
              toolName={toolName ?? "work_output"}
              outputId={data.outputId}
              onToolInteraction={onToolInteraction}
            />
          </span>
        ) : null}
      </div>
      <WorkOutputView kind={data.kind} content={data.content} compact />
    </div>
  );
}

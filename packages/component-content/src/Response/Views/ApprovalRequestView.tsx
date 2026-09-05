import { Button } from "@ngriffin_uk/polychat-component-ui";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { JsonView } from "../JsonView";
import type { ToolInteractionHandler } from "../registry";

const TOOL_NAME = "request_approval";

interface ApprovalRequestData {
  message?: string;
  options?: string[];
  context?: unknown;
  timestamp?: string;
  resolved?: boolean;
  approval?: {
    interactionId?: string;
    toolName?: string;
  };
}

function readApprovalData(data: unknown): ApprovalRequestData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as ApprovalRequestData;

  return {
    ...record,
    options: Array.isArray(record.options)
      ? record.options.filter((option): option is string => typeof option === "string")
      : undefined,
  };
}

export function ApprovalRequestView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const approval = readApprovalData(data);
  const [chosen, setChosen] = useState<string | null>(null);
  const options = approval.options?.length ? approval.options : ["Approve", "Reject"];
  const isResolved = approval.resolved === true || chosen !== null;

  const choose = (option: string) => {
    if (isResolved || !onToolInteraction) {
      return;
    }

    setChosen(option);
    const pendingTool = approval.approval;
    const resolution = option.toLowerCase() === "approve" ? "approved" : "rejected";
    const interactionInput = `${option}: ${approval.message ?? "the requested action"}`;

    onToolInteraction(pendingTool?.toolName ?? TOOL_NAME, "submitPrompt", {
      option,
      message: approval.message,
      input: interactionInput,
      ...(pendingTool?.interactionId && pendingTool.toolName
        ? {
            interactionId: pendingTool.interactionId,
            resolution,
            ...(resolution === "approved" ? { approvedToolName: pendingTool.toolName } : {}),
          }
        : {}),
    });
  };

  return (
    <section
      data-responsetype="approval-request"
      className="space-y-3 rounded-lg border border-attention/45 bg-attention/12 p-3 text-sm"
      aria-label="Approval required"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">Approval required</p>
          {approval.message && <p className="break-words text-foreground">{approval.message}</p>}
        </div>
      </div>

      {approval.context != null && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Additional context
          </summary>
          <div className="mt-1">
            <JsonView data={approval.context} />
          </div>
        </details>
      )}

      {isResolved ? (
        <output className="block text-xs font-medium text-muted-foreground">
          {chosen ? `You chose ${chosen}.` : "This request has been answered."}
        </output>
      ) : onToolInteraction ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => (
            <Button
              key={option}
              size="xs"
              variant={index === 0 ? "default" : "outline"}
              onClick={() => choose(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

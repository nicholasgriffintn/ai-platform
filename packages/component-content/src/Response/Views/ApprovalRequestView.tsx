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

/**
 * Replaces a server-rendered HTML template whose buttons were never wired to anything. The choice
 * is the decision, so it submits rather than filling the composer.
 */
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
    onToolInteraction(TOOL_NAME, "submitPrompt", { option, message: approval.message });
  };

  return (
    <section
      data-responsetype="approval-request"
      className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/25"
      aria-label="Approval required"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Approval required</p>
          {approval.message && (
            <p className="break-words text-zinc-700 dark:text-zinc-300">{approval.message}</p>
          )}
        </div>
      </div>

      {approval.context != null && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
            Additional context
          </summary>
          <div className="mt-1">
            <JsonView data={approval.context} />
          </div>
        </details>
      )}

      {isResolved ? (
        <output className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {chosen ? `You chose ${chosen}.` : "This request has been answered."}
        </output>
      ) : onToolInteraction ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={
                index === 0
                  ? "cursor-pointer rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  : "cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

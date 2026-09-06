import { Button } from "@ngriffin_uk/polychat-component-ui";
import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";

import { readApprovalRequest } from "../approval-request";
import { JsonView } from "../JsonView";
import type { ToolInteractionHandler } from "../registry";

const TOOL_NAME = "request_approval";

interface ApprovalSubmission {
  key: string;
  option: string;
  status: "submitting" | "acknowledged" | "failed";
}

export function ApprovalRequestView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const approval = readApprovalRequest(data);
  const [submission, setSubmission] = useState<ApprovalSubmission | null>(null);
  const submittingRef = useRef(false);
  const activeSubmission = submission?.key === approval.key ? submission : null;
  const options = approval.options?.length ? approval.options : ["Approve", "Reject"];
  const authoritativeState = approval.authoritativeState;
  const isAuthoritativelyResolved = authoritativeState.status !== "pending";
  const isSubmitting = activeSubmission?.status === "submitting";
  const isAcknowledged = activeSubmission?.status === "acknowledged";

  const choose = async (option: string) => {
    if (isAuthoritativelyResolved || submittingRef.current || !onToolInteraction) {
      return;
    }

    submittingRef.current = true;
    setSubmission({ key: approval.key, option, status: "submitting" });
    const pendingTool = approval.approval;
    const resolution = option.toLowerCase() === "approve" ? "approved" : "rejected";
    const interactionInput = `${option}: ${approval.message ?? "the requested action"}`;

    try {
      await onToolInteraction(pendingTool?.toolName ?? TOOL_NAME, "submitPrompt", {
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
      setSubmission({ key: approval.key, option, status: "acknowledged" });
    } catch {
      setSubmission({ key: approval.key, option, status: "failed" });
    } finally {
      submittingRef.current = false;
    }
  };

  const statusText =
    authoritativeState.status === "expired"
      ? "This approval request expired."
      : authoritativeState.status === "resolved"
        ? authoritativeState.resolution === "approved"
          ? "Approved."
          : authoritativeState.resolution === "rejected"
            ? "Rejected."
            : "This request has been answered."
        : isAcknowledged
          ? `You chose ${activeSubmission.option}.`
          : null;

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

      {statusText ? (
        <output className="block text-xs font-medium text-muted-foreground">{statusText}</output>
      ) : onToolInteraction ? (
        <div className="space-y-2">
          {activeSubmission?.status === "failed" ? (
            <p role="alert" className="text-xs font-medium text-failure">
              Approval was not submitted. Try again.
            </p>
          ) : isSubmitting ? (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              Submitting {activeSubmission.option}…
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {options.map((option, index) => (
              <Button
                key={option}
                size="xs"
                variant={index === 0 ? "default" : "outline"}
                disabled={isSubmitting}
                onClick={() => void choose(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

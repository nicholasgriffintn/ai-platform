import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  STANDING_APPROVAL_OPTION,
  TEAMMATE_STANDING_APPROVAL_DAYS,
  TEAMMATE_STANDING_OFFER_STREAK,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";

import { readApprovalRequest } from "../approval-request";
import { JsonView } from "../JsonView";
import type { ToolInteractionHandler } from "../registry";

const TOOL_NAME = "request_approval";

type ApprovalRule = "act" | "hand_off";

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
  const ruleToolName =
    approval.approvalRequired && approval.approval?.toolName !== TOOL_NAME
      ? approval.approval?.toolName
      : undefined;
  const approveOption = options.find((option) => option.toLowerCase() === "approve");
  const rejectOption = options.find((option) => option.toLowerCase() === "reject");

  const choose = async (option: string, rule?: ApprovalRule) => {
    if (isAuthoritativelyResolved || submittingRef.current || !onToolInteraction) {
      return;
    }

    submittingRef.current = true;
    setSubmission({ key: approval.key, option, status: "submitting" });
    const pendingTool = approval.approval;
    const standing = option === STANDING_APPROVAL_OPTION;
    const resolution = standing || option.toLowerCase() === "approve" ? "approved" : "rejected";
    const directResolution =
      approval.approvalRequired === true || pendingTool?.toolName === "request_approval";

    try {
      await onToolInteraction(pendingTool?.toolName ?? TOOL_NAME, "submitPrompt", {
        option,
        ...(approval.approvalRequired ? { approvalRequired: true } : {}),
        ...(!directResolution
          ? {
              message: approval.message,
              input: `${option}: ${approval.message ?? "the requested action"}`,
            }
          : {}),
        ...(pendingTool?.interactionId && pendingTool.toolName
          ? {
              interactionId: pendingTool.interactionId,
              resolution,
              ...(standing ? { standing: true } : {}),
            }
          : {}),
        ...(rule ? { rule } : {}),
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
        ? approval.approval?.toolName === "request_approval" && approval.selectedOption
          ? `You selected: ${approval.selectedOption}`
          : authoritativeState.resolution === "approved"
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
          {approval.approvedInARow !== undefined &&
            approval.approvedInARow >= TEAMMATE_STANDING_OFFER_STREAK &&
            options.includes(STANDING_APPROVAL_OPTION) && (
              <p className="text-xs text-muted-foreground">
                You have approved this {approval.approvedInARow} times in a row here.{" "}
                {STANDING_APPROVAL_OPTION} stops asking for {TEAMMATE_STANDING_APPROVAL_DAYS} days.
              </p>
            )}
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
          {ruleToolName && approveOption && rejectOption ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Decide once:</span>
              {approval.allowRuleLifts ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => void choose(approveOption, "act")}
                >
                  Always allow {ruleToolName}
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => void choose(rejectOption, "hand_off")}
              >
                Never use {ruleToolName}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

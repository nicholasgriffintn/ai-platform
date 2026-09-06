import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectWorkbenchApprovalItem } from "@ngriffin_uk/polychat-utility-react";
import { ShieldQuestion } from "lucide-react";

export type { ProjectWorkbenchApprovalItem } from "@ngriffin_uk/polychat-utility-react";

export interface ProjectWorkbenchApprovalsProps {
  approvals: ProjectWorkbenchApprovalItem[];
  canControl: boolean;
  disabledReason?: string;
  isUpdating?: boolean;
  errorMessage?: string;
  onResolve: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

function runAction(action: () => Promise<void>): void {
  void action().catch(() => undefined);
}

export function ProjectWorkbenchApprovals({
  approvals,
  canControl,
  disabledReason,
  isUpdating = false,
  errorMessage,
  onResolve,
}: ProjectWorkbenchApprovalsProps) {
  if (approvals.length === 0) {
    return null;
  }

  const disabled = !canControl || Boolean(disabledReason) || isUpdating;
  const actionTitle =
    disabledReason ??
    (!canControl ? "Only the person who started this run can resolve its approvals." : undefined);

  return (
    <section
      aria-label="Pending command approvals"
      className="mb-2 space-y-2 rounded-lg border border-attention/45 bg-attention/12 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-4 text-attention" aria-hidden="true" />
        <h3 className="text-sm font-medium">Needs approval</h3>
      </div>
      <ul className="space-y-2">
        {approvals.map((approval) => (
          <li key={approval.id} className="rounded-md bg-surface p-2">
            <p className="font-mono text-xs break-words whitespace-pre-wrap">
              {approval.command ?? "Command details unavailable"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                title={actionTitle}
                onClick={() => runAction(() => onResolve(approval.id, "approved"))}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                title={actionTitle}
                onClick={() => runAction(() => onResolve(approval.id, "rejected"))}
              >
                Reject
              </Button>
              <span className="ml-auto text-xs text-muted-foreground capitalize">
                {approval.state}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {errorMessage ? <p className="text-xs text-failure">{errorMessage}</p> : null}
    </section>
  );
}

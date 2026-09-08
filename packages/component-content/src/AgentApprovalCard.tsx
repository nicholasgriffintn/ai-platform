import { Button, type ButtonVariant } from "@ngriffin_uk/polychat-component-ui";
import type { AgentApproval, AgentApprovalDecision } from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

export interface AgentApprovalCardProps {
  approval: AgentApproval;
  onDecision: (decision: AgentApprovalDecision) => Promise<void>;
}

const decisionLabels: Record<AgentApprovalDecision, string> = {
  accept: "Allow",
  accept_for_session: "Allow for this session",
  decline: "Decline",
  cancel: "Cancel the turn",
};

const decisionVariants: Record<AgentApprovalDecision, ButtonVariant> = {
  accept: "outline",
  accept_for_session: "outline",
  decline: "ghost",
  cancel: "ghost",
};

export function AgentApprovalCard({ approval, onDecision }: AgentApprovalCardProps) {
  const [isAnswering, setIsAnswering] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const answer = async (decision: AgentApprovalDecision) => {
    setIsAnswering(true);
    setFailure(null);

    try {
      await onDecision(decision);
    } catch (error) {
      setFailure(
        error instanceof Error && error.message
          ? error.message
          : "Could not send that answer to the agent.",
      );
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-elevated p-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-attention" />
        <span className="min-w-0 truncate font-medium text-foreground">{approval.title}</span>
      </div>
      {approval.command?.trim() && (
        <code className="block overflow-x-auto rounded border border-border bg-canvas px-2 py-1 text-xs text-foreground">
          {approval.command}
        </code>
      )}
      {approval.cwd?.trim() && (
        <div className="truncate text-xs text-muted-foreground">{approval.cwd}</div>
      )}
      {approval.detail?.trim() && (
        <div className="text-xs whitespace-pre-wrap text-muted-foreground">{approval.detail}</div>
      )}
      {failure && (
        <div className="rounded border border-failure/30 bg-failure/10 p-2 text-xs text-failure">
          {failure}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {approval.decisions.map((decision) => (
          <Button
            key={decision}
            type="button"
            size="xs"
            variant={decisionVariants[decision]}
            onClick={() => void answer(decision)}
            disabled={isAnswering}
            className={decision === "decline" ? "text-failure hover:text-failure/80" : undefined}
          >
            {decisionLabels[decision]}
          </Button>
        ))}
      </div>
    </div>
  );
}

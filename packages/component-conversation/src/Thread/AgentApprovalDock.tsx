import { AgentApprovalCard } from "@ngriffin_uk/polychat-component-content";
import type { AgentApproval, AgentApprovalDecision } from "@ngriffin_uk/polychat-schemas";

export interface ConversationAgentApproval {
  approval: AgentApproval;
  answer: (decision: AgentApprovalDecision) => Promise<void>;
}

export interface ConversationAgentApprovals {
  pending: ConversationAgentApproval[];
  resolve: (requestId: string) => void;
}

export function AgentApprovalDock({ pending, resolve }: ConversationAgentApprovals) {
  if (pending.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {pending.map((entry) => (
        <AgentApprovalCard
          key={entry.approval.requestId}
          approval={entry.approval}
          onDecision={async (decision) => {
            await entry.answer(decision);
            resolve(entry.approval.requestId);
          }}
        />
      ))}
    </div>
  );
}

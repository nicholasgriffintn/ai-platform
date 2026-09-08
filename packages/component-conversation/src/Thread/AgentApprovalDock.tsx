import { AgentApprovalCard } from "@ngriffin_uk/polychat-component-content";
import {
  selectPendingAgentApprovals,
  useAgentApprovalStore,
} from "@ngriffin_uk/polychat-library-client";

interface AgentApprovalDockProps {
  conversationId: string | undefined;
}

export function AgentApprovalDock({ conversationId }: AgentApprovalDockProps) {
  const pendingApprovals = useAgentApprovalStore(selectPendingAgentApprovals(conversationId));
  const resolveApproval = useAgentApprovalStore((state) => state.resolveApproval);

  if (!conversationId || pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {pendingApprovals.map((pending) => (
        <AgentApprovalCard
          key={pending.approval.requestId}
          approval={pending.approval}
          onDecision={async (decision) => {
            await pending.answer(decision);
            resolveApproval(conversationId, pending.approval.requestId);
          }}
        />
      ))}
    </div>
  );
}

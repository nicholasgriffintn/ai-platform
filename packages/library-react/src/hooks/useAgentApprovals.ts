import {
  selectPendingAgentApprovals,
  useAgentApprovalStore,
} from "@ngriffin_uk/polychat-library-client";
import { useCallback, useMemo } from "react";

export function useConversationAgentApprovals(conversationId: string | null | undefined) {
  const pending = useAgentApprovalStore(selectPendingAgentApprovals(conversationId));
  const resolveApproval = useAgentApprovalStore((state) => state.resolveApproval);
  const resolve = useCallback(
    (requestId: string) => {
      if (conversationId) {
        resolveApproval(conversationId, requestId);
      }
    },
    [conversationId, resolveApproval],
  );

  return useMemo(() => ({ pending, resolve }), [pending, resolve]);
}

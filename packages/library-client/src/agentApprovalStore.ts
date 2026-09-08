import type { AgentApproval, AgentApprovalDecision } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";

export interface PendingAgentApproval {
  approval: AgentApproval;
  answer: (decision: AgentApprovalDecision) => Promise<void>;
}

export interface AgentApprovalStore {
  approvals: Record<string, PendingAgentApproval[]>;
  requestApproval: (
    conversationId: string,
    approval: AgentApproval,
    answer: (decision: AgentApprovalDecision) => Promise<void>,
  ) => void;
  resolveApproval: (conversationId: string, requestId: string) => void;
  clearApprovals: (conversationId: string) => void;
}

const NO_PENDING_APPROVALS: PendingAgentApproval[] = [];

export const useAgentApprovalStore = create<AgentApprovalStore>()((set) => ({
  approvals: {},
  requestApproval: (conversationId, approval, answer) =>
    set((current) => {
      const pending = current.approvals[conversationId] ?? NO_PENDING_APPROVALS;
      const replacement: PendingAgentApproval = { approval, answer };
      const existingIndex = pending.findIndex(
        (entry) => entry.approval.requestId === approval.requestId,
      );
      const next =
        existingIndex >= 0
          ? pending.map((entry, index) => (index === existingIndex ? replacement : entry))
          : [...pending, replacement];

      return { approvals: { ...current.approvals, [conversationId]: next } };
    }),
  resolveApproval: (conversationId, requestId) =>
    set((current) => {
      const pending = current.approvals[conversationId];

      if (!pending) {
        return current;
      }

      const next = pending.filter((entry) => entry.approval.requestId !== requestId);

      if (next.length === pending.length) {
        return current;
      }

      if (next.length === 0) {
        const { [conversationId]: _resolved, ...remaining } = current.approvals;

        return { approvals: remaining };
      }

      return { approvals: { ...current.approvals, [conversationId]: next } };
    }),
  clearApprovals: (conversationId) =>
    set((current) => {
      if (!current.approvals[conversationId]) {
        return current;
      }

      const { [conversationId]: _cleared, ...remaining } = current.approvals;

      return { approvals: remaining };
    }),
}));

export function selectPendingAgentApprovals(conversationId: string | null | undefined) {
  return (state: AgentApprovalStore): PendingAgentApproval[] =>
    conversationId
      ? (state.approvals[conversationId] ?? NO_PENDING_APPROVALS)
      : NO_PENDING_APPROVALS;
}

import z from "zod/v4";

export const delegationStateSchema = z.enum([
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
  "done",
  "failed",
  "cancelled",
  "expired",
]);
export type DelegationState = z.infer<typeof delegationStateSchema>;

export const LIVE_DELEGATION_STATES: readonly DelegationState[] = [
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
];

export function isLiveDelegationState(state: DelegationState): boolean {
  return LIVE_DELEGATION_STATES.includes(state);
}

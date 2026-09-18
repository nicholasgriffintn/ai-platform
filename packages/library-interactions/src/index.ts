export { InteractionError, isInteractionError, type InteractionErrorCode } from "./errors.js";
export type {
  ApprovalClient,
  ApprovalControlState,
  ApprovalRecord,
  ApprovalStatus,
  ApprovalWindow,
} from "./approval-types.js";
export {
  APPROVAL_TIMEOUT_REASON,
  evaluateApprovalSla,
  type ApprovalSlaState,
  type ApprovalSlaTransition,
} from "./approval-sla.js";
export {
  resolveApproval,
  type ResolveApprovalParams,
  type ResolveApprovalResult,
} from "./await-approval.js";

import {
  DELEGATION_MAX_DEPTH,
  DELEGATION_MAX_FAN_OUT,
  type DelegationContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IRequest } from "~/types";

const DEPTH_REFUSAL =
  "This conversation is already running as a delegate and cannot delegate further. " +
  "Do the work here, or report back so the conversation that asked can decide.";
const FAN_OUT_REFUSAL =
  "This conversation already has the maximum number of delegate runs in flight. " +
  "Wait for one to settle before delegating again.";

export interface DelegationSpawnGuardResult {
  allowed: boolean;
  reason?: string;
  depth: number;
  liveDelegations: number;
}

export function resolveDelegationContext(request: IRequest): DelegationContext | undefined {
  return request.request?.delegation_context;
}

export async function checkDelegationSpawn(
  context: ToolExecutionContext,
): Promise<DelegationSpawnGuardResult> {
  const delegationContext = resolveDelegationContext(context.request);
  const depth = delegationContext?.depth ?? 0;

  if (depth >= DELEGATION_MAX_DEPTH) {
    return { allowed: false, reason: DEPTH_REFUSAL, depth, liveDelegations: 0 };
  }

  const parentConversationId = context.request.request?.completion_id;
  const parentRunId = context.request.request?.run_id;

  if (!parentConversationId || !parentRunId || !context.request.context) {
    return { allowed: true, depth, liveDelegations: 0 };
  }

  const liveDelegations = await context.request.context.repositories.delegations.countLiveForParent(
    parentConversationId,
    parentRunId,
  );

  if (liveDelegations >= DELEGATION_MAX_FAN_OUT) {
    return { allowed: false, reason: FAN_OUT_REFUSAL, depth, liveDelegations };
  }

  return { allowed: true, depth, liveDelegations };
}

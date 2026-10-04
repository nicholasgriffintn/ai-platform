import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { Delegation } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export async function canControlDelegation(
  context: ServiceContext,
  delegation: Pick<Delegation, "parentConversationId" | "parentRunId">,
  userId: number,
): Promise<boolean> {
  const run = await context.repositories.conversationRuns.getById(delegation.parentRunId);

  if (!run) {
    return false;
  }

  return authorise("delegation.control", {
    actorId: String(userId),
    initiatorId: String(run.initiatorUserId),
    conversationId: run.conversationId,
    parentConversationId: delegation.parentConversationId,
    conversationAccessible: await context.repositories.workspaces.canAccessConversation(
      delegation.parentConversationId,
      userId,
    ),
  }).allowed;
}

export async function canControlAnyDelegation(
  context: ServiceContext,
  delegations: readonly Delegation[],
  userId: number,
): Promise<boolean> {
  const groups = new Map<string, Delegation>();

  for (const delegation of delegations) {
    groups.set(delegation.parentRunId, delegation);
  }

  const decisions = await Promise.all(
    [...groups.values()].map((delegation) => canControlDelegation(context, delegation, userId)),
  );

  return decisions.some(Boolean);
}

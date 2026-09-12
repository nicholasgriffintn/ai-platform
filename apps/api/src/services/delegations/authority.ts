import type { Delegation } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

export async function canControlDelegation(
  context: ServiceContext,
  delegation: Pick<Delegation, "parentConversationId" | "parentRunId">,
  userId: number,
): Promise<boolean> {
  const run = await context.repositories.conversationRuns.getById(delegation.parentRunId);

  return (
    run?.conversationId === delegation.parentConversationId &&
    run.initiatorUserId === userId &&
    (await context.repositories.workspaces.canAccessConversation(
      delegation.parentConversationId,
      userId,
    ))
  );
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

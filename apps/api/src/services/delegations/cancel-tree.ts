import { isLiveDelegationState, type Delegation } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { transitionDelegation } from "./settle";

export async function cancelDelegationTree(
  context: ServiceContext,
  parentRunId: string,
): Promise<void> {
  const visited = new Set<string>();

  const cancelChildren = async (delegations: Delegation[]) => {
    for (const delegation of delegations) {
      if (visited.has(delegation.id)) {
        continue;
      }

      visited.add(delegation.id);

      if (isLiveDelegationState(delegation.state)) {
        await transitionDelegation(context, delegation.id, "cancelled", {
          summary: "The parent run was cancelled.",
          outputIds: [],
        });
      }

      const childRun = await context.repositories.conversationRuns.getLatestForConversation(
        delegation.childConversationId,
      );

      if (childRun) {
        await context.repositories.conversationRuns.transition({
          runId: childRun.id,
          attempt: childRun.attempt,
          status: "cancelled",
          terminalReason: "The parent run was cancelled",
        });
      }

      await cancelChildren(
        await context.repositories.delegations.listByParentConversationId(
          delegation.childConversationId,
        ),
      );
    }
  };

  await cancelChildren(await context.repositories.delegations.listByParentRunId(parentRunId));
}

export async function cancelDelegationsForConversation(
  context: ServiceContext,
  parentConversationId: string,
): Promise<void> {
  const delegations =
    await context.repositories.delegations.listByParentConversationId(parentConversationId);
  const parentRunIds = new Set(delegations.map((delegation) => delegation.parentRunId));

  for (const parentRunId of parentRunIds) {
    await cancelDelegationTree(context, parentRunId);
  }
}

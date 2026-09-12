import { isLiveDelegationState, type Delegation } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { canControlDelegation } from "./authority";
import { cancelDelegationChildRun } from "./cancel-child-run";
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

      if (!isLiveDelegationState(delegation.state)) {
        continue;
      }

      await transitionDelegation(
        context,
        delegation.id,
        "cancelled",
        {
          summary: "The parent run was cancelled.",
          outputIds: [],
        },
        context.requireUser().id,
      );

      await cancelDelegationChildRun(
        context,
        delegation,
        context.requireUser().id,
        "The parent run was cancelled",
      );

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
  userId: number,
): Promise<boolean> {
  const delegations =
    await context.repositories.delegations.listByParentConversationId(parentConversationId);
  const controllable = await Promise.all(
    delegations.map(async (delegation) => ({
      delegation,
      allowed: await canControlDelegation(context, delegation, userId),
    })),
  );
  const parentRunIds = new Set(
    controllable
      .filter(({ allowed, delegation }) => allowed && isLiveDelegationState(delegation.state))
      .map(({ delegation }) => delegation.parentRunId),
  );

  for (const parentRunId of parentRunIds) {
    await cancelDelegationTree(context, parentRunId);
  }

  return parentRunIds.size > 0;
}

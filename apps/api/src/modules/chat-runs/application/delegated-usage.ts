import {
  delegationRunCommandId,
  type ChatRun,
  type ChatRunDelegatedUsage,
  type ChatRunUsage,
  type Delegation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { hydrateChatRunUsage } from "./usage";

export function summariseDelegatedUsage(
  delegations: readonly Delegation[],
  childUsage: ReadonlyMap<string, ChatRunUsage>,
  teammateNames: ReadonlyMap<string, string>,
): ChatRunDelegatedUsage[] {
  return delegations.map((delegation) => {
    const usage = childUsage.get(delegation.id);

    return {
      delegationId: delegation.id,
      teammateId: delegation.teammateId,
      teammateName: teammateNames.get(delegation.teammateId) ?? null,
      state: delegation.state,
      runId: usage?.runId ?? null,
      measurement: usage?.measurement ?? "unknown",
      consumptionStatus: usage?.consumption.status ?? "unknown",
      creditMicros: usage?.consumption.creditMicros ?? null,
    };
  });
}

export async function hydrateDelegatedUsage(
  context: ServiceContext,
  run: ChatRun,
): Promise<ChatRun> {
  if (!run.usage) {
    return run;
  }

  const delegations = await context.repositories.delegations.listByParentRunId(run.id);

  if (delegations.length === 0) {
    return run;
  }

  const [receipts, teammates] = await Promise.all([
    Promise.all(
      delegations.map((delegation) =>
        context.repositories.conversationRuns.getCommandReceipt(
          run.initiatorUserId,
          delegationRunCommandId(delegation.id),
        ),
      ),
    ),
    context.repositories.teammates.getTeammatesByIds([
      ...new Set(delegations.map((delegation) => delegation.teammateId)),
    ]),
  ]);
  const childRuns = await hydrateChatRunUsage(
    context.repositories,
    receipts.flatMap((receipt) => (receipt ? [receipt.run] : [])),
  );
  const childRunsById = new Map(childRuns.map((childRun) => [childRun.id, childRun]));
  const childUsageByDelegation = new Map(
    delegations.flatMap((delegation, index) => {
      const childUsage = childRunsById.get(receipts[index]?.run.id ?? "")?.usage;

      return childUsage ? [[delegation.id, childUsage] as const] : [];
    }),
  );

  return {
    ...run,
    usage: {
      ...run.usage,
      delegated: summariseDelegatedUsage(
        delegations,
        childUsageByDelegation,
        new Map(teammates.map((teammate) => [teammate.id, teammate.name])),
      ),
    },
  };
}

import {
  MAX_DELEGATION_RUN_RESUMES,
  type ChatRun,
  type ChatRunDelegatedUsage,
  type ChatRunUsage,
  type Delegation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { delegationRunCommandId } from "~/modules/delegations/application/run-identity";

import { hydrateChatRunUsage } from "./usage";

function summariseMeasurement(usages: readonly ChatRunUsage[]): ChatRunUsage["measurement"] {
  const measurements = new Set(usages.map((usage) => usage.measurement));

  if (measurements.has("off_platform")) {
    return "off_platform";
  }

  if (
    measurements.has("mixed") ||
    (measurements.has("reported") && measurements.has("estimated"))
  ) {
    return "mixed";
  }

  if (measurements.has("reported")) {
    return "reported";
  }

  return measurements.has("estimated") ? "estimated" : "unknown";
}

function summariseConsumptionStatus(
  usages: readonly ChatRunUsage[],
): ChatRunDelegatedUsage["consumptionStatus"] {
  if (
    usages.length > 0 &&
    usages.every(
      (usage) => usage.consumption.status === "recorded" && usage.consumption.creditMicros !== null,
    )
  ) {
    return "recorded";
  }

  return usages.some((usage) => usage.consumption.status === "processing")
    ? "processing"
    : "unknown";
}

export function summariseDelegatedUsage(
  delegations: readonly Delegation[],
  childUsage: ReadonlyMap<string, readonly ChatRunUsage[]>,
  teammateNames: ReadonlyMap<string, string>,
): ChatRunDelegatedUsage[] {
  return delegations.map((delegation) => {
    const usages = childUsage.get(delegation.id) ?? [];
    const recordedCredits = usages.flatMap((usage) =>
      usage.consumption.status === "recorded" && usage.consumption.creditMicros !== null
        ? [usage.consumption.creditMicros]
        : [],
    );

    return {
      delegationId: delegation.id,
      teammateId: delegation.teammateId,
      teammateName: teammateNames.get(delegation.teammateId) ?? null,
      state: delegation.state,
      runIds: usages.map((usage) => usage.runId),
      measurement: summariseMeasurement(usages),
      consumptionStatus: summariseConsumptionStatus(usages),
      creditMicros:
        recordedCredits.length > 0
          ? recordedCredits.reduce((total, creditMicros) => total + creditMicros, 0)
          : null,
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

  const [receiptsByDelegation, teammates] = await Promise.all([
    Promise.all(
      delegations.map((delegation) => {
        const commandIds = [
          delegationRunCommandId(delegation.id),
          ...Array.from({ length: MAX_DELEGATION_RUN_RESUMES }, (_, index) =>
            delegationRunCommandId(delegation.id, index + 1),
          ),
        ];

        return Promise.all(
          commandIds.map((commandId) =>
            context.repositories.conversationRuns.getCommandReceipt(run.initiatorUserId, commandId),
          ),
        );
      }),
    ),
    context.repositories.teammates.getTeammatesByIds([
      ...new Set(delegations.map((delegation) => delegation.teammateId)),
    ]),
  ]);
  const receipts = receiptsByDelegation.flatMap((commandReceipts) =>
    commandReceipts.flatMap((receipt) => (receipt ? [receipt] : [])),
  );
  const childRuns = await hydrateChatRunUsage(
    context.repositories,
    receipts.map((receipt) => receipt.run),
  );
  const childUsageByRunId = new Map<string, ChatRunUsage>();

  for (const childRun of childRuns) {
    if (childRun.usage) {
      childUsageByRunId.set(childRun.id, childRun.usage);
    }
  }

  const childUsageByDelegation = new Map<string, ChatRunUsage[]>();

  for (const [index, delegation] of delegations.entries()) {
    const usages = receiptsByDelegation[index].flatMap((receipt) => {
      const childUsage = receipt ? childUsageByRunId.get(receipt.run.id) : undefined;

      return childUsage ? [childUsage] : [];
    });

    childUsageByDelegation.set(delegation.id, usages);
  }

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

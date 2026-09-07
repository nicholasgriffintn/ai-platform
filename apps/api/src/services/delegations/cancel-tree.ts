import type { ServiceContext } from "~/lib/context/serviceContext";

const LIVE_DELEGATION_STATES = new Set([
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
]);

export async function cancelDelegationTree(
  context: ServiceContext,
  parentRunId: string,
): Promise<void> {
  const visited = new Set<string>();

  const cancelChildren = async (
    delegations: Awaited<ReturnType<typeof context.repositories.delegations.listByParentRunId>>,
  ) => {
    for (const delegation of delegations) {
      if (visited.has(delegation.id)) {
        continue;
      }

      visited.add(delegation.id);

      if (LIVE_DELEGATION_STATES.has(delegation.state)) {
        await context.repositories.delegations.cancelIfLive(delegation.id);
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

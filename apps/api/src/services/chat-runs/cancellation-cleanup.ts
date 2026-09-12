import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { releaseTeammateComputerAgentLease } from "../teammates/computers";

export async function cleanupCancelledChatRun(
  context: ServiceContext,
  run: ChatRun,
): Promise<void> {
  if (run.teammateContextId) {
    await releaseTeammateComputerAgentLease({
      context,
      contextId: run.teammateContextId,
      runId: run.id,
    });
  }

  await Promise.all([
    context.repositories.connectorOperationApprovals.deleteUnconsumedForRun(run.id, run.attempt),
    context.repositories.composioConnectorSessions.markRunCleanupPending({
      runId: run.id,
      cleanupAfter: new Date().toISOString(),
    }),
  ]);
}

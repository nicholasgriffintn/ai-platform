import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ComposioConnectorSessionRepository } from "~/modules/connectors/infrastructure/ComposioConnectorSessionRepository";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { releaseTeammateComputerAgentLease } from "~/modules/teammates/application/computers";

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
    context.repositories
      .get(ConnectorOperationApprovalRepository)
      .deleteUnconsumedForRun(run.id, run.attempt),
    context.repositories.get(ComposioConnectorSessionRepository).markRunCleanupPending({
      runId: run.id,
      cleanupAfter: new Date().toISOString(),
    }),
  ]);
}

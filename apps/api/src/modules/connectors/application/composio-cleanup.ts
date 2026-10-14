import { deleteComposioToolSession } from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

const CLEANUP_BATCH_SIZE = 50;
const CLEANUP_LEASE_MS = 5 * 60 * 1000;
const CLEANUP_RETRY_MS = 15 * 60 * 1000;
const logger = getLogger({ prefix: "services/apps/connectors/composio-cleanup" });

export async function reapComposioConnectorSessions(
  env: IEnv,
  now = new Date(),
): Promise<{ deleted: number; failed: number }> {
  const repositories = RepositoryManager.getInstance(env);
  const nowIso = now.toISOString();
  const due = await repositories.composioConnectorSessions.listCleanupDue({
    now: nowIso,
    limit: CLEANUP_BATCH_SIZE,
  });
  let deleted = 0;
  let failed = 0;

  for (const candidate of due) {
    const claimed = await repositories.composioConnectorSessions.claimCleanup({
      id: candidate.id,
      now: nowIso,
      leaseUntil: new Date(now.getTime() + CLEANUP_LEASE_MS).toISOString(),
    });

    if (!claimed) {
      continue;
    }

    try {
      await deleteComposioToolSession({ env, sessionId: claimed.remoteSessionId });
      await repositories.composioConnectorSessions.delete(claimed.id);
      deleted += 1;
    } catch (error) {
      failed += 1;
      await repositories.composioConnectorSessions.markCleanupPending({
        id: claimed.id,
        cleanupAfter: new Date(now.getTime() + CLEANUP_RETRY_MS).toISOString(),
      });
      logger.warn("Composio connector session cleanup failed", {
        sessionHandle: claimed.id,
        attempt: claimed.cleanupAttempts + 1,
        error: getErrorMessage(error),
      });
    }
  }

  return { deleted, failed };
}

import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import type { IEnv } from "~/types";

const RESOLVED_APPROVAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export async function deleteExpiredConnectorOperationApprovals(
  env: IEnv,
  now = new Date(),
): Promise<number> {
  return new ConnectorOperationApprovalRepository(env).deleteExpired({
    pendingBefore: now.toISOString(),
    resolvedBefore: new Date(now.getTime() - RESOLVED_APPROVAL_RETENTION_MS).toISOString(),
  });
}

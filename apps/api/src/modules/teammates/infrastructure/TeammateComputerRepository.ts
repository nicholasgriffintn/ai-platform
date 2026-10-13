import type { TeammateComputer, TeammateComputerLease } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { TeammateComputerRow } from "~/infrastructure/database/schema";
import { teammateComputerColumns } from "~/infrastructure/database/teammate-computer-storage";
import type { IEnv } from "~/types";

export interface TeammateComputerRecord extends TeammateComputer {
  providerHandle: string | null;
  leaseFence: number;
}

function formatComputer(row: TeammateComputerRow): TeammateComputerRecord {
  const storedLease: TeammateComputerLease | null =
    row.lease_kind && row.lease_owner_id && row.lease_expires_at && row.lease_fence > 0
      ? {
          kind: row.lease_kind,
          ownerId: row.lease_owner_id,
          expiresAt: row.lease_expires_at,
          fence: row.lease_fence,
        }
      : null;
  const lease = storedLease && Date.parse(storedLease.expiresAt) > Date.now() ? storedLease : null;

  return {
    id: row.id,
    contextId: row.context_id,
    provider: row.provider,
    providerHandle: row.provider_handle,
    leaseFence: row.lease_fence,
    checkpointReference: row.checkpoint_reference,
    status: row.status === "takeover" && !lease ? "ready" : row.status,
    lease,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TeammateComputerRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async getByContextId(contextId: string): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `SELECT ${teammateComputerColumns} FROM teammate_context WHERE id = ? AND computer_id IS NOT NULL`,
      [contextId],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async ensure(contextId: string, provider: string): Promise<TeammateComputerRecord> {
    await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context SET computer_id = ?, computer_provider = ?,
       computer_status = 'stopped', computer_lease_fence = 0,
       computer_created_at = CURRENT_TIMESTAMP, computer_updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND computer_id IS NULL`,
      [`teammate_computer_${generateId()}`, provider, contextId],
      true,
    );
    const computer = await this.getByContextId(contextId);

    if (!computer) {
      throw new Error("Teammate computer could not be created");
    }

    return computer;
  }

  async updateState(params: {
    id: string;
    status: TeammateComputer["status"];
    providerHandle?: string | null;
    checkpointReference?: string | null;
    lastError?: string | null;
    expectedFence?: number;
  }): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context
       SET computer_status = ?,
           computer_provider_handle = CASE WHEN ? THEN ? ELSE computer_provider_handle END,
           computer_checkpoint_reference = CASE WHEN ? THEN ? ELSE computer_checkpoint_reference END,
           computer_last_error = ?, computer_updated_at = CURRENT_TIMESTAMP
       WHERE computer_id = ? AND (? IS NULL OR computer_lease_fence = ?)
       RETURNING ${teammateComputerColumns}`,
      [
        params.status,
        params.providerHandle !== undefined,
        params.providerHandle ?? null,
        params.checkpointReference !== undefined,
        params.checkpointReference ?? null,
        params.lastError ?? null,
        params.id,
        params.expectedFence ?? null,
        params.expectedFence ?? null,
      ],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async claimProvisioning(id: string): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context
       SET computer_status = 'provisioning', computer_last_error = NULL, computer_updated_at = CURRENT_TIMESTAMP
       WHERE computer_id = ?
         AND (
           computer_status IN ('stopped', 'error', 'destroyed')
           OR (computer_status = 'provisioning' AND computer_updated_at <= datetime('now', '-5 minutes'))
         )
         AND (computer_lease_expires_at IS NULL OR computer_lease_expires_at <= CURRENT_TIMESTAMP)
       RETURNING ${teammateComputerColumns}`,
      [id],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async acquireLease(params: {
    id: string;
    kind: TeammateComputerLease["kind"];
    ownerId: string;
    expiresAt: string;
    now: string;
  }): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context
       SET computer_lease_kind = ?, computer_lease_owner_id = ?, computer_lease_expires_at = ?,
           computer_lease_fence = computer_lease_fence + 1,
           computer_status = CASE
             WHEN ? = 'user' THEN 'takeover'
             WHEN computer_status = 'takeover' THEN 'ready'
             ELSE computer_status
           END,
           computer_updated_at = CURRENT_TIMESTAMP
       WHERE computer_id = ? AND computer_status != 'destroyed'
         AND (computer_lease_expires_at IS NULL OR computer_lease_expires_at <= ? OR computer_lease_owner_id = ?)
       RETURNING ${teammateComputerColumns}`,
      [
        params.kind,
        params.ownerId,
        params.expiresAt,
        params.kind,
        params.id,
        params.now,
        params.ownerId,
      ],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async forceAcquireLease(params: {
    id: string;
    ownerId: string;
    expiresAt: string;
  }): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context
       SET computer_lease_kind = 'user', computer_lease_owner_id = ?, computer_lease_expires_at = ?,
           computer_lease_fence = computer_lease_fence + 1, computer_updated_at = CURRENT_TIMESTAMP
       WHERE computer_id = ? AND computer_status != 'destroyed'
       RETURNING ${teammateComputerColumns}`,
      [params.ownerId, params.expiresAt, params.id],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async releaseLease(params: {
    id: string;
    ownerId: string;
    fence: number;
  }): Promise<TeammateComputerRecord | null> {
    const row = await this.runQuery<TeammateComputerRow>(
      `UPDATE teammate_context
       SET computer_lease_kind = NULL, computer_lease_owner_id = NULL, computer_lease_expires_at = NULL,
           computer_status = CASE WHEN computer_status = 'takeover' THEN 'ready' ELSE computer_status END,
           computer_updated_at = CURRENT_TIMESTAMP
       WHERE computer_id = ? AND computer_lease_owner_id = ? AND computer_lease_fence = ?
       RETURNING ${teammateComputerColumns}`,
      [params.id, params.ownerId, params.fence],
      true,
    );

    return row ? formatComputer(row) : null;
  }
}

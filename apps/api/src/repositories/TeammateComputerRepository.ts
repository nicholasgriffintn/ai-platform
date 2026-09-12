import type { TeammateComputer, TeammateComputerLease } from "@ngriffin_uk/polychat-schemas";

import type { TeammateComputerRow } from "~/lib/database/schema";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

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
      "SELECT * FROM teammate_computer WHERE context_id = ?",
      [contextId],
      true,
    );

    return row ? formatComputer(row) : null;
  }

  async ensure(contextId: string, provider: string): Promise<TeammateComputerRecord> {
    await this.runQuery<TeammateComputerRow>(
      `INSERT OR IGNORE INTO teammate_computer (id, context_id, provider)
       VALUES (?, ?, ?)`,
      [`teammate_computer_${generateId()}`, contextId, provider],
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
      `UPDATE teammate_computer
       SET status = ?,
           provider_handle = CASE WHEN ? THEN ? ELSE provider_handle END,
           checkpoint_reference = CASE WHEN ? THEN ? ELSE checkpoint_reference END,
           last_error = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (? IS NULL OR lease_fence = ?)
       RETURNING *`,
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
      `UPDATE teammate_computer
       SET status = 'provisioning', last_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND (
           status IN ('stopped', 'error', 'destroyed')
           OR (status = 'provisioning' AND updated_at <= datetime('now', '-5 minutes'))
         )
         AND (lease_expires_at IS NULL OR lease_expires_at <= CURRENT_TIMESTAMP)
       RETURNING *`,
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
      `UPDATE teammate_computer
       SET lease_kind = ?, lease_owner_id = ?, lease_expires_at = ?,
           lease_fence = lease_fence + 1,
           status = CASE
             WHEN ? = 'user' THEN 'takeover'
             WHEN status = 'takeover' THEN 'ready'
             ELSE status
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status != 'destroyed'
         AND (lease_expires_at IS NULL OR lease_expires_at <= ? OR lease_owner_id = ?)
       RETURNING *`,
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
      `UPDATE teammate_computer
       SET lease_kind = 'user', lease_owner_id = ?, lease_expires_at = ?,
           lease_fence = lease_fence + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status != 'destroyed'
       RETURNING *`,
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
      `UPDATE teammate_computer
       SET lease_kind = NULL, lease_owner_id = NULL, lease_expires_at = NULL,
           status = CASE WHEN status = 'takeover' THEN 'ready' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND lease_owner_id = ? AND lease_fence = ?
       RETURNING *`,
      [params.id, params.ownerId, params.fence],
      true,
    );

    return row ? formatComputer(row) : null;
  }
}

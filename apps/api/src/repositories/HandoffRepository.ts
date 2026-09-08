import type {
  CreateHandoffRequest,
  Handoff,
  HandoffRequested,
} from "@ngriffin_uk/polychat-schemas";

import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

interface HandoffRow {
  id: string;
  conversation_id: string;
  machine_id: string;
  requested: string;
  draft: string | null;
  state: Handoff["state"];
  claimed_by: string | null;
  created_at: string;
  expires_at: string;
}

function parseRow(row: HandoffRow): Handoff {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    target: { kind: "machine", machineId: row.machine_id },
    requested: JSON.parse(row.requested) as HandoffRequested,
    ...(row.draft ? { draft: JSON.parse(row.draft) as Handoff["draft"] } : {}),
    state: row.state,
    ...(row.claimed_by ? { claimedBy: row.claimed_by } : {}),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

const selectFields = `id, conversation_id, machine_id, requested, draft, state,
  claimed_by, created_at, expires_at`;

export class HandoffRepository extends BaseRepository {
  async create(userId: number, input: CreateHandoffRequest, now = new Date()): Promise<Handoff> {
    const id = `handoff_${generateId()}`;
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();

    await this.executeRun(
      `INSERT INTO handoff (
        id, user_id, conversation_id, machine_id, requested, draft, state, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        userId,
        input.conversationId,
        input.machineId,
        JSON.stringify(input.requested),
        input.draft ? JSON.stringify(input.draft) : null,
        createdAt,
        expiresAt,
      ],
    );

    return {
      id,
      conversationId: input.conversationId,
      target: { kind: "machine", machineId: input.machineId },
      requested: input.requested,
      ...(input.draft ? { draft: input.draft } : {}),
      state: "pending",
      createdAt,
      expiresAt,
    };
  }

  async getForUser(id: string, userId: number): Promise<Handoff | null> {
    await this.executeRun(
      `UPDATE handoff SET state = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND state = 'pending' AND expires_at <= CURRENT_TIMESTAMP`,
      [id, userId],
    );
    const row = await this.runQuery<HandoffRow>(
      `SELECT ${selectFields} FROM handoff WHERE id = ? AND user_id = ?`,
      [id, userId],
      true,
    );

    return row ? parseRow(row) : null;
  }

  async claim(id: string, machineId: string, now = new Date()): Promise<Handoff | null> {
    await this.executeRun(
      `UPDATE handoff SET state = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND state = 'pending' AND expires_at <= ?`,
      [id, now.toISOString()],
    );
    const result = await this.executeRun(
      `UPDATE handoff
       SET state = 'claimed', claimed_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND machine_id = ? AND state = 'pending' AND expires_at > ?`,
      [machineId, id, machineId, now.toISOString()],
    );

    if (!result.success || result.meta.changes !== 1) {
      return null;
    }

    const row = await this.runQuery<HandoffRow>(
      `SELECT ${selectFields} FROM handoff WHERE id = ?`,
      [id],
      true,
    );

    return row ? parseRow(row) : null;
  }

  async decide(id: string, machineId: string, state: "running" | "done" | "declined") {
    await this.executeRun(
      `UPDATE handoff SET state = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND claimed_by = ? AND state IN ('claimed', 'running')`,
      [state, id, machineId],
    );
  }
}

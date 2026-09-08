import {
  DELEGATION_MAX_DEPTH,
  DELEGATION_MAX_FAN_OUT,
  type Delegation,
  type DelegationResult,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { DelegationRow } from "~/lib/database/schema";
import type { IEnv } from "~/types";
import { formatDelegation } from "~/utils/delegations";
import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseRepository } from "./BaseRepository";

export interface CreateDelegationParams {
  id: string;
  parentConversationId: string;
  childConversationId: string;
  parentRunId: string;
  depth: number;
  teammateId: string;
  goal: string;
  waitFor: Delegation["waitFor"];
  budget: Delegation["budget"];
}

export class DelegationRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createDelegation(params: CreateDelegationParams): Promise<Delegation> {
    const row = await this.runQuery<DelegationRow>(
      `INSERT INTO delegation (
         id, parent_conversation_id, child_conversation_id, parent_run_id,
         depth, teammate_id, goal, wait_for, max_credit_micros, max_steps, deadline,
         state, result_json
       ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?
       WHERE ? BETWEEN 1 AND ?
         AND NOT EXISTS (SELECT 1 FROM delegation WHERE child_conversation_id = ?)
         AND (SELECT COUNT(*) FROM delegation
              WHERE parent_conversation_id = ? AND parent_run_id = ?
                AND state IN ('queued', 'running', 'awaiting_input', 'awaiting_approval')) < ?
       RETURNING *`,
      [
        params.id,
        params.parentConversationId,
        params.childConversationId,
        params.parentRunId,
        params.depth,
        params.teammateId,
        params.goal,
        params.waitFor,
        params.budget.maxCreditMicros,
        params.budget.maxSteps,
        params.budget.deadline,
        null,
        params.depth,
        DELEGATION_MAX_DEPTH,
        params.parentConversationId,
        params.parentConversationId,
        params.parentRunId,
        DELEGATION_MAX_FAN_OUT,
      ],
      true,
    );

    if (!row) {
      throw new AssistantError(
        "The delegation depth or concurrent run limit has been reached.",
        ErrorType.PARAMS_ERROR,
        409,
      );
    }

    return formatDelegation(row);
  }

  async getById(id: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      "SELECT * FROM delegation WHERE id = ?",
      [id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }

  async getByChildConversationId(childConversationId: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      "SELECT * FROM delegation WHERE child_conversation_id = ?",
      [childConversationId],
      true,
    );

    return row ? formatDelegation(row) : null;
  }

  async listByParentConversationId(parentConversationId: string): Promise<Delegation[]> {
    const rows = await this.runQuery<DelegationRow>(
      `SELECT * FROM delegation
       WHERE parent_conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
      [parentConversationId],
    );

    return rows.map(formatDelegation);
  }

  async listByParentRunId(parentRunId: string): Promise<Delegation[]> {
    const rows = await this.runQuery<DelegationRow>(
      `SELECT * FROM delegation
       WHERE parent_run_id = ?
       ORDER BY created_at ASC, id ASC`,
      [parentRunId],
    );

    return rows.map(formatDelegation);
  }

  async countLiveForParent(parentConversationId: string, parentRunId: string): Promise<number> {
    const row = await this.runQuery<{ count: number }>(
      `SELECT COUNT(*) AS count FROM delegation
       WHERE parent_conversation_id = ?
         AND parent_run_id = ?
         AND state IN ('queued', 'running', 'awaiting_input', 'awaiting_approval')`,
      [parentConversationId, parentRunId],
      true,
    );

    return Number(row?.count ?? 0);
  }

  async claimDelegation(id: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = 'running', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND state = 'queued'
       RETURNING *`,
      [id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }

  async updateState(
    id: string,
    state: DelegationState,
    result: DelegationResult | null = null,
  ): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND state IN ('queued', 'running', 'awaiting_input', 'awaiting_approval')
       RETURNING *`,
      [state, result ? JSON.stringify(result) : null, id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }

  async expireIfLive(id: string, summary: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = 'expired',
           result_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND state IN ('queued', 'running', 'awaiting_input', 'awaiting_approval')
       RETURNING *`,
      [JSON.stringify({ summary, outputIds: [] }), id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }

  async cancelIfLive(id: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = 'cancelled',
           result_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND state IN ('queued', 'running', 'awaiting_input', 'awaiting_approval')
       RETURNING *`,
      [JSON.stringify({ summary: "The parent run was cancelled.", outputIds: [] }), id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }
}

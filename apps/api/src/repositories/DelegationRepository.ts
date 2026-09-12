import {
  DELEGATION_MAX_DEPTH,
  DELEGATION_MAX_FAN_OUT,
  LIVE_DELEGATION_STATES,
  type Delegation,
  type DelegationResult,
  type DelegationMemoryBinding,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { DelegationRow } from "~/lib/database/schema";
import type { IEnv } from "~/types";
import { formatDelegation } from "~/utils/delegations";
import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseRepository } from "./BaseRepository";

const LIVE_STATE_SQL = LIVE_DELEGATION_STATES.map((state) => `'${state}'`).join(", ");

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
  memoryBindings?: DelegationMemoryBinding[];
  predecessorDelegationId?: string | null;
  continuationMode?: "new" | "resume" | "fresh";
}

export class DelegationRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createDelegation(params: CreateDelegationParams): Promise<Delegation> {
    const row = await this.runQuery<DelegationRow>(
      `INSERT INTO delegation (
         id, parent_conversation_id, child_conversation_id, parent_run_id,
         depth, teammate_id, goal, wait_for, max_credit_micros, max_steps, deadline,
         state, result_json, memory_bindings_json, predecessor_delegation_id, continuation_mode
       ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?
       WHERE ? BETWEEN 1 AND ?
         AND ? = COALESCE(
           (SELECT MAX(parent.depth) + 1 FROM delegation parent
            WHERE parent.child_conversation_id = ?),
           1
         )
         AND NOT EXISTS (
           SELECT 1 FROM delegation
           WHERE child_conversation_id = ? AND state IN (${LIVE_STATE_SQL})
         )
         AND (SELECT COUNT(*) FROM delegation
              WHERE parent_conversation_id = ? AND parent_run_id = ?
                AND state IN (${LIVE_STATE_SQL})) < ?
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
        JSON.stringify(params.memoryBindings ?? []),
        params.predecessorDelegationId ?? null,
        params.continuationMode ?? "new",
        params.depth,
        DELEGATION_MAX_DEPTH,
        params.depth,
        params.parentConversationId,
        params.childConversationId,
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
      `SELECT * FROM delegation
       WHERE child_conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
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
         AND state IN (${LIVE_STATE_SQL})`,
      [parentConversationId, parentRunId],
      true,
    );

    return row?.count ?? 0;
  }

  async claimDelegation(id: string): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = 'running',
           updated_at = CASE WHEN state = 'queued' THEN CURRENT_TIMESTAMP ELSE updated_at END
       WHERE id = ? AND state IN ('queued', 'running')
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
    deliveryUserId?: number,
  ): Promise<Delegation | null> {
    const update = this.env.DB.prepare(
      `UPDATE delegation
       SET state = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND state IN (${LIVE_STATE_SQL})
       RETURNING *`,
    ).bind(state, result ? JSON.stringify(result) : null, id);

    if (LIVE_DELEGATION_STATES.includes(state) || deliveryUserId === undefined) {
      const row = await update.first<DelegationRow>();

      return row ? formatDelegation(row) : null;
    }

    const deliveryId = `delegation_wake_${id}`;
    const [updated] = await this.executeBatch<DelegationRow>([
      update,
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO tasks (
             id, task_type, user_id, project_id, task_data, schedule_type, priority,
             created_by, status, attempts, max_attempts
           )
           SELECT ?, 'delegation_wake', ?, NULL,
                  json_object(
                    'parentConversationId', delegation.parent_conversation_id,
                    'parentRunId', delegation.parent_run_id
                  ),
                  'immediate', 4, 'user', 'pending', 0, 3
           FROM delegation
           WHERE delegation.id = ?
             AND delegation.state NOT IN (${LIVE_STATE_SQL})`,
      ).bind(deliveryId, deliveryUserId, id),
    ]);
    const row = updated.results[0];

    return row ? formatDelegation(row) : null;
  }
}

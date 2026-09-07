import {
  delegationSchema,
  type Delegation,
  type DelegationResult,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { DelegationRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

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

function parseResult(value: unknown): DelegationResult | null {
  if (!value) {
    return null;
  }

  const parsed = delegationSchema.shape.result.safeParse(
    typeof value === "string" ? safeParseJson<unknown>(value) : value,
  );

  return parsed.success ? parsed.data : null;
}

function formatDelegation(row: DelegationRow): Delegation {
  return delegationSchema.parse({
    id: row.id,
    parentConversationId: row.parent_conversation_id,
    childConversationId: row.child_conversation_id,
    parentRunId: row.parent_run_id,
    depth: row.depth,
    teammateId: row.teammate_id,
    goal: row.goal,
    waitFor: row.wait_for,
    budget: {
      maxCreditMicros: row.max_credit_micros,
      maxSteps: row.max_steps,
      deadline: row.deadline,
    },
    state: row.state,
    result: parseResult(row.result_json),
  });
}

export class DelegationRepository extends BaseRepository {
  async createDelegation(params: CreateDelegationParams): Promise<Delegation> {
    const row = await this.runQuery<DelegationRow>(
      `INSERT INTO delegation (
         id, parent_conversation_id, child_conversation_id, parent_run_id,
         depth, teammate_id, goal, wait_for, max_credit_micros, max_steps, deadline,
         state, result_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)
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
      ],
      true,
    );

    if (!row) {
      throw new AssistantError("Failed to create delegation", ErrorType.DATABASE_ERROR);
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

  async updateState(
    id: string,
    state: DelegationState,
    result: DelegationResult | null = null,
  ): Promise<Delegation | null> {
    const row = await this.runQuery<DelegationRow>(
      `UPDATE delegation
       SET state = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING *`,
      [state, result ? JSON.stringify(result) : null, id],
      true,
    );

    return row ? formatDelegation(row) : null;
  }
}

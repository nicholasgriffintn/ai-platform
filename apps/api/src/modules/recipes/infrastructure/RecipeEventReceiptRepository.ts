import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { RecipeEventReceiptRow } from "~/infrastructure/database/schema";

export type RecipeEventReceiptState = "evaluating" | "skipped" | "queued";

export type RecipeEventClaim =
  | { status: "execute"; executionToken: string }
  | { status: RecipeEventReceiptState; taskId: string | null };

export class RecipeEventReceiptRepository extends BaseRepository {
  async claimEvent(input: {
    id: string;
    triggerId: string;
    eventId: string;
    now: string;
    leaseExpiresAt: string;
  }): Promise<RecipeEventClaim> {
    const executionToken = generateId();
    const inserted = await this.executeRun(
      `INSERT OR IGNORE INTO delivery (
         delivery_type, id, trigger_id, event_id, state, execution_token,
         execution_lease_expires_at, created_at, updated_at
       ) VALUES ('recipe_event', ?, ?, ?, 'evaluating', ?, ?, ?, ?)`,
      [
        input.id,
        input.triggerId,
        input.eventId,
        executionToken,
        input.leaseExpiresAt,
        input.now,
        input.now,
      ],
    );

    if (inserted.meta?.changes) {
      return { status: "execute", executionToken };
    }

    const reclaimed = await this.runQuery<RecipeEventReceiptRow>(
      `UPDATE delivery
       SET execution_token = ?, execution_lease_expires_at = ?, updated_at = ?
       WHERE delivery_type = 'recipe_event' AND id = ? AND trigger_id = ? AND event_id = ?
         AND state = 'evaluating'
         AND (execution_lease_expires_at IS NULL OR execution_lease_expires_at <= ?)
       RETURNING *`,
      [
        executionToken,
        input.leaseExpiresAt,
        input.now,
        input.id,
        input.triggerId,
        input.eventId,
        input.now,
      ],
      true,
    );

    if (reclaimed) {
      return { status: "execute", executionToken };
    }

    const existing = await this.runQuery<RecipeEventReceiptRow>(
      `SELECT * FROM delivery
       WHERE delivery_type = 'recipe_event' AND id = ? AND trigger_id = ? AND event_id = ?`,
      [input.id, input.triggerId, input.eventId],
      true,
    );

    if (!existing) {
      throw new AssistantError("Recipe event receipt conflict", ErrorType.CONFLICT_ERROR, 409);
    }

    return { status: existing.state, taskId: existing.queued_task_id };
  }

  async settleEvent(input: {
    id: string;
    triggerId: string;
    executionToken: string;
    state: Exclude<RecipeEventReceiptState, "evaluating">;
    decisionReceipt?: unknown;
    taskId?: string;
    now: string;
  }): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE delivery
       SET state = ?, decision_receipt = ?, queued_task_id = ?, execution_token = NULL,
           execution_lease_expires_at = NULL, updated_at = ?
       WHERE delivery_type = 'recipe_event' AND id = ? AND trigger_id = ? AND state = 'evaluating' AND execution_token = ?`,
      [
        input.state,
        input.decisionReceipt ? JSON.stringify(input.decisionReceipt) : null,
        input.taskId ?? null,
        input.now,
        input.id,
        input.triggerId,
        input.executionToken,
      ],
    );

    return Boolean(result.meta?.changes);
  }
}

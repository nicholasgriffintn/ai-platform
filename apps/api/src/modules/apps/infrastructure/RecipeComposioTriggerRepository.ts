import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type {
  RecipeComposioTrigger,
  RecipeEventReceiptRow,
} from "~/infrastructure/database/schema";

export interface RecipeComposioTriggerRecord extends Omit<RecipeComposioTrigger, "configuration"> {
  configuration: Record<string, unknown>;
}

export type RecipeEventReceiptState = "evaluating" | "skipped" | "queued";

export type RecipeEventClaim =
  | { status: "execute"; executionToken: string }
  | { status: RecipeEventReceiptState; taskId: string | null };

function parseTrigger(record: RecipeComposioTrigger): RecipeComposioTriggerRecord {
  return {
    ...record,
    configuration:
      typeof record.configuration === "string"
        ? parseJsonRecord(record.configuration)
        : record.configuration,
  };
}

export class RecipeComposioTriggerRepository extends BaseRepository {
  async createTrigger(input: {
    installationId: string;
    createdByUserId: number;
    projectId?: string | null;
    providerId: string;
    triggerSlug: string;
    externalTriggerId: string;
    connectedAccountId: string;
    externalUserId: string;
    configuration?: Record<string, unknown>;
    condition?: string;
  }): Promise<RecipeComposioTriggerRecord> {
    const insert = this.buildInsertQuery(
      "recipe_composio_trigger",
      {
        id: generateId(),
        installation_id: input.installationId,
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId ?? null,
        provider_id: input.providerId,
        trigger_slug: input.triggerSlug,
        external_trigger_id: input.externalTriggerId,
        connected_account_id: input.connectedAccountId,
        external_user_id: input.externalUserId,
        configuration: input.configuration ?? {},
        condition: input.condition ?? null,
        status: "active",
      },
      { jsonFields: ["configuration"], returning: "*" },
    );

    if (!insert) {
      throw new AssistantError(
        "Failed to build recipe Composio trigger insert",
        ErrorType.INTERNAL_ERROR,
      );
    }

    const result = await this.runQuery<RecipeComposioTrigger>(insert.query, insert.values, true);

    if (!result) {
      throw new AssistantError(
        "Failed to create recipe Composio trigger",
        ErrorType.DATABASE_ERROR,
      );
    }

    return parseTrigger(result);
  }

  async claimEvent(input: {
    id: string;
    triggerId: string;
    eventId: string;
    now: string;
    leaseExpiresAt: string;
  }): Promise<RecipeEventClaim> {
    const executionToken = generateId();
    const inserted = await this.executeRun(
      `INSERT OR IGNORE INTO recipe_event_receipt (
         id, trigger_id, event_id, state, execution_token,
         execution_lease_expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, 'evaluating', ?, ?, ?, ?)`,
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
      `UPDATE recipe_event_receipt
       SET execution_token = ?, execution_lease_expires_at = ?, updated_at = ?
       WHERE id = ? AND trigger_id = ? AND event_id = ?
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
      `SELECT * FROM recipe_event_receipt
       WHERE id = ? AND trigger_id = ? AND event_id = ?`,
      [input.id, input.triggerId, input.eventId],
      true,
    );

    if (!existing) {
      throw new AssistantError("Recipe event receipt conflict", ErrorType.CONFLICT_ERROR, 409);
    }

    return { status: existing.state, taskId: existing.task_id };
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
      `UPDATE recipe_event_receipt
       SET state = ?, decision_receipt = ?, task_id = ?, execution_token = NULL,
           execution_lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND trigger_id = ? AND state = 'evaluating' AND execution_token = ?`,
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

  async getTriggerByExternalId(
    externalTriggerId: string,
  ): Promise<RecipeComposioTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("recipe_composio_trigger", {
      external_trigger_id: externalTriggerId,
    });
    const result = await this.runQuery<RecipeComposioTrigger>(query, values, true);

    return result ? parseTrigger(result) : null;
  }

  async getTriggerForOwner(
    triggerId: string,
    userId: number,
  ): Promise<RecipeComposioTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("recipe_composio_trigger", {
      id: triggerId,
      created_by_user_id: userId,
    });
    const result = await this.runQuery<RecipeComposioTrigger>(query, values, true);

    return result ? parseTrigger(result) : null;
  }

  async listInstallationTriggers(
    installationId: string,
    userId: number,
  ): Promise<RecipeComposioTriggerRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "recipe_composio_trigger",
      { installation_id: installationId, created_by_user_id: userId },
      { orderBy: "created_at ASC" },
    );
    const results = await this.runQuery<RecipeComposioTrigger>(query, values);

    return results.map(parseTrigger);
  }

  async listTriggersByConnectedAccountId(
    connectedAccountId: string,
  ): Promise<RecipeComposioTriggerRecord[]> {
    const { query, values } = this.buildSelectQuery("recipe_composio_trigger", {
      connected_account_id: connectedAccountId,
    });
    const results = await this.runQuery<RecipeComposioTrigger>(query, values);

    return results.map(parseTrigger);
  }

  async markConnectedAccountError(connectedAccountId: string, lastError: string): Promise<number> {
    const result = await this.executeRun(
      `UPDATE recipe_composio_trigger
			 SET status = 'error', last_error = ?
			 WHERE connected_account_id = ?`,
      [lastError, connectedAccountId],
    );

    return result.meta?.changes ?? 0;
  }

  async updateStatus(
    triggerId: string,
    userId: number,
    status: "active" | "paused" | "error",
    lastError?: string | null,
  ): Promise<RecipeComposioTriggerRecord | null> {
    const update = this.buildUpdateQuery(
      "recipe_composio_trigger",
      { status, last_error: lastError ?? null },
      ["status", "last_error"],
      "id = ? AND created_by_user_id = ?",
      [triggerId, userId],
      { returning: "*" },
    );

    if (!update) {
      return null;
    }

    const result = await this.runQuery<RecipeComposioTrigger>(update.query, update.values, true);

    return result ? parseTrigger(result) : null;
  }

  async deleteTrigger(triggerId: string, userId: number): Promise<boolean> {
    const result = await this.executeRun(
      "DELETE FROM recipe_composio_trigger WHERE id = ? AND created_by_user_id = ?",
      [triggerId, userId],
    );

    return Boolean(result.meta?.changes);
  }
}

import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { RecipeComposioTrigger } from "~/infrastructure/database/schema";

export interface RecipeComposioTriggerRecord extends Omit<RecipeComposioTrigger, "configuration"> {
  configuration: Record<string, unknown>;
}

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
      "event_subscription",
      {
        broker: "composio",
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

  async getTriggerByExternalId(
    externalTriggerId: string,
  ): Promise<RecipeComposioTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("event_subscription", {
      broker: "composio",
      external_trigger_id: externalTriggerId,
    });
    const result = await this.runQuery<RecipeComposioTrigger>(query, values, true);

    return result ? parseTrigger(result) : null;
  }

  async getTriggerForOwner(
    triggerId: string,
    userId: number,
  ): Promise<RecipeComposioTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("event_subscription", {
      broker: "composio",
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
      "event_subscription",
      { broker: "composio", installation_id: installationId, created_by_user_id: userId },
      { orderBy: "created_at ASC" },
    );
    const results = await this.runQuery<RecipeComposioTrigger>(query, values);

    return results.map(parseTrigger);
  }

  async listTriggersByConnectedAccountId(
    connectedAccountId: string,
  ): Promise<RecipeComposioTriggerRecord[]> {
    const { query, values } = this.buildSelectQuery("event_subscription", {
      broker: "composio",
      connected_account_id: connectedAccountId,
    });
    const results = await this.runQuery<RecipeComposioTrigger>(query, values);

    return results.map(parseTrigger);
  }

  async markConnectedAccountError(connectedAccountId: string, lastError: string): Promise<number> {
    const result = await this.executeRun(
      `UPDATE event_subscription
			 SET status = 'error', last_error = ?
			 WHERE broker = 'composio' AND connected_account_id = ?`,
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
      "event_subscription",
      { status, last_error: lastError ?? null },
      ["status", "last_error"],
      "broker = 'composio' AND id = ? AND created_by_user_id = ?",
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
      "DELETE FROM event_subscription WHERE broker = 'composio' AND id = ? AND created_by_user_id = ?",
      [triggerId, userId],
    );

    return Boolean(result.meta?.changes);
  }
}

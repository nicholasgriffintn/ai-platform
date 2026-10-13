import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { RecipeComposioTrigger } from "~/infrastructure/database/schema";

const WEBHOOK_BROKER = "webhook";

export type RecipeWebhookTriggerRecord = Omit<RecipeComposioTrigger, "configuration">;

export class RecipeWebhookTriggerRepository extends BaseRepository {
  async createTrigger(input: {
    installationId: string;
    createdByUserId: number;
    projectId: string | null;
    tokenHash: string;
    condition?: string;
  }): Promise<RecipeWebhookTriggerRecord> {
    const insert = this.buildInsertQuery(
      "event_subscription",
      {
        broker: WEBHOOK_BROKER,
        id: generateId(),
        installation_id: input.installationId,
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId,
        provider_id: WEBHOOK_BROKER,
        trigger_slug: WEBHOOK_BROKER,
        external_trigger_id: input.tokenHash,
        connected_account_id: "",
        external_user_id: "",
        configuration: {},
        condition: input.condition ?? null,
        status: "active",
      },
      { jsonFields: ["configuration"], returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to build webhook trigger insert", ErrorType.INTERNAL_ERROR);
    }

    const result = await this.runQuery<RecipeWebhookTriggerRecord>(
      insert.query,
      insert.values,
      true,
    );

    if (!result) {
      throw new AssistantError("Failed to create webhook trigger", ErrorType.DATABASE_ERROR);
    }

    return result;
  }

  async getTriggerByTokenHash(tokenHash: string): Promise<RecipeWebhookTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("event_subscription", {
      broker: WEBHOOK_BROKER,
      external_trigger_id: tokenHash,
    });

    return this.runQuery<RecipeWebhookTriggerRecord>(query, values, true);
  }

  async getTriggerForOwner(
    triggerId: string,
    userId: number,
  ): Promise<RecipeWebhookTriggerRecord | null> {
    const { query, values } = this.buildSelectQuery("event_subscription", {
      broker: WEBHOOK_BROKER,
      id: triggerId,
      created_by_user_id: userId,
    });

    return this.runQuery<RecipeWebhookTriggerRecord>(query, values, true);
  }

  async listInstallationTriggers(
    installationId: string,
    userId: number,
  ): Promise<RecipeWebhookTriggerRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "event_subscription",
      { broker: WEBHOOK_BROKER, installation_id: installationId, created_by_user_id: userId },
      { orderBy: "created_at ASC" },
    );

    return this.runQuery<RecipeWebhookTriggerRecord>(query, values);
  }

  async updateStatus(
    triggerId: string,
    userId: number,
    status: "active" | "paused",
  ): Promise<RecipeWebhookTriggerRecord | null> {
    return this.runQuery<RecipeWebhookTriggerRecord>(
      `UPDATE event_subscription
       SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE broker = 'webhook' AND id = ? AND created_by_user_id = ?
       RETURNING *`,
      [status, triggerId, userId],
      true,
    );
  }

  async rotateToken(
    triggerId: string,
    userId: number,
    tokenHash: string,
  ): Promise<RecipeWebhookTriggerRecord | null> {
    return this.runQuery<RecipeWebhookTriggerRecord>(
      `UPDATE event_subscription
       SET external_trigger_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE broker = 'webhook' AND id = ? AND created_by_user_id = ?
       RETURNING *`,
      [tokenHash, triggerId, userId],
      true,
    );
  }

  async deleteTrigger(triggerId: string, userId: number): Promise<boolean> {
    const result = await this.executeRun(
      "DELETE FROM event_subscription WHERE broker = 'webhook' AND id = ? AND created_by_user_id = ?",
      [triggerId, userId],
    );

    return Boolean(result.meta?.changes);
  }
}

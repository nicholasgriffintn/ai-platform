import type { RecipeComposioTrigger } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { parseJsonRecord } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

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
		if (!update) return null;
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

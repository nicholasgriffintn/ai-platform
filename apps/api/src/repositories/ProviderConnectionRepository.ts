import { BaseRepository } from "./BaseRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface ProviderConnectionRecord {
	id: string;
	user_id: number;
	provider: string;
	kind: string;
	external_id: string;
	status: "connected" | "invalid" | "revoked";
	encrypted_data: string;
	metadata: string;
	created_at: string;
	updated_at: string | null;
}

export class ProviderConnectionRepository extends BaseRepository {
	async upsertConnection(input: {
		userId: number;
		provider: string;
		kind: string;
		externalId?: string | null;
		encryptedData: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	}): Promise<ProviderConnectionRecord> {
		const existing = await this.getConnection(
			input.userId,
			input.provider,
			input.kind,
			input.externalId ?? "",
		);
		if (existing) {
			const update = this.buildUpdateQuery(
				"provider_connection",
				{
					encrypted_data: input.encryptedData,
					metadata: input.metadata ?? {},
					status: "connected",
				},
				["encrypted_data", "metadata", "status"],
				"id = ?",
				[existing.id],
				{ jsonFields: ["encrypted_data", "metadata"] },
			);
			if (update) await this.executeRun(update.query, update.values);
			return (await this.getConnectionById(existing.id)) ?? existing;
		}

		const insert = this.buildInsertQuery(
			"provider_connection",
			{
				id: generateId(),
				user_id: input.userId,
				provider: input.provider,
				kind: input.kind,
				external_id: input.externalId ?? "",
				status: "connected",
				encrypted_data: input.encryptedData,
				metadata: input.metadata ?? {},
			},
			{ jsonFields: ["encrypted_data", "metadata"], returning: "*" },
		);
		if (!insert) throw new AssistantError("Failed to build connection", ErrorType.INTERNAL_ERROR);
		const connection = await this.runQuery<ProviderConnectionRecord>(
			insert.query,
			insert.values,
			true,
		);
		if (!connection)
			throw new AssistantError("Failed to create connection", ErrorType.DATABASE_ERROR);
		return connection;
	}

	async getConnectionById(connectionId: string): Promise<ProviderConnectionRecord | null> {
		const { query, values } = this.buildSelectQuery("provider_connection", { id: connectionId });
		return this.runQuery<ProviderConnectionRecord>(query, values, true);
	}

	async getConnection(
		userId: number,
		provider: string,
		kind: string,
		externalId?: string | null,
	): Promise<ProviderConnectionRecord | null> {
		const { query, values } = this.buildSelectQuery("provider_connection", {
			user_id: userId,
			provider,
			kind,
			external_id: externalId ?? "",
		});
		return this.runQuery<ProviderConnectionRecord>(query, values, true);
	}

	async getConnectionByExternalId(
		provider: string,
		kind: string,
		externalId: string,
	): Promise<ProviderConnectionRecord | null> {
		const { query, values } = this.buildSelectQuery("provider_connection", {
			provider,
			kind,
			external_id: externalId,
		});
		return this.runQuery<ProviderConnectionRecord>(query, values, true);
	}

	async listConnections(userId: number, provider?: string): Promise<ProviderConnectionRecord[]> {
		const { query, values } = this.buildSelectQuery(
			"provider_connection",
			{ user_id: userId, provider },
			{ orderBy: "updated_at DESC, created_at DESC" },
		);
		return this.runQuery<ProviderConnectionRecord>(query, values);
	}

	async deleteConnection(
		userId: number,
		provider: string,
		kind: string,
		externalId?: string | null,
	): Promise<void> {
		const { query, values } = this.buildDeleteQuery("provider_connection", {
			user_id: userId,
			provider,
			kind,
			external_id: externalId ?? "",
		});
		await this.executeRun(query, values);
	}
}

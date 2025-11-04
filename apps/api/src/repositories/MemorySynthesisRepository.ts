import { BaseRepository } from "./BaseRepository";
import type { MemorySynthesis } from "~/lib/database/schema";
import { generateId } from "~/utils/id";

export interface CreateMemorySynthesisParams {
	user_id: number;
	synthesis_text: string;
	memory_ids?: string[];
	memory_count?: number;
	tokens_used?: number;
	namespace?: string;
	synthesis_version?: number;
}

export class MemorySynthesisRepository extends BaseRepository {
	public async createSynthesis(
		params: CreateMemorySynthesisParams,
	): Promise<MemorySynthesis | null> {
		const id = generateId();
		const insert = this.buildInsertQuery(
			"memory_syntheses",
			{
				id,
				user_id: params.user_id,
				synthesis_text: params.synthesis_text,
				memory_ids: params.memory_ids
					? JSON.stringify(params.memory_ids)
					: null,
				memory_count: params.memory_count ?? 0,
				tokens_used: params.tokens_used ?? null,
				namespace: params.namespace ?? "global",
				synthesis_version: params.synthesis_version ?? 1,
				is_active: true,
				superseded_by: null,
			},
			{ jsonFields: ["memory_ids"], returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<MemorySynthesis>(insert.query, insert.values, true);
	}

	public async getActiveSynthesis(
		userId: number,
		namespace = "global",
	): Promise<MemorySynthesis | null> {
		const result = await this.runQuery<MemorySynthesis>(
			`SELECT * FROM memory_syntheses
       WHERE user_id = ? AND namespace = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
			[userId, namespace],
			true,
		);
		return result;
	}

	public async getSynthesisById(
		synthesisId: string,
	): Promise<MemorySynthesis | null> {
		const { query, values } = this.buildSelectQuery("memory_syntheses", {
			id: synthesisId,
		});
		return this.runQuery<MemorySynthesis>(query, values, true);
	}

	public async getSynthesesByUserId(
		userId: number,
		namespace?: string,
		limit = 10,
	): Promise<MemorySynthesis[]> {
		let query: string;
		let values: any[];

		if (namespace) {
			query = `SELECT * FROM memory_syntheses
               WHERE user_id = ? AND namespace = ?
               ORDER BY created_at DESC
               LIMIT ?`;
			values = [userId, namespace, limit];
		} else {
			query = `SELECT * FROM memory_syntheses
               WHERE user_id = ?
               ORDER BY created_at DESC
               LIMIT ?`;
			values = [userId, limit];
		}

		const result = await this.runQuery<MemorySynthesis>(query, values);
		return result || [];
	}

	public async supersedeSynthesis(
		oldSynthesisId: string,
		newSynthesisId: string,
	): Promise<boolean> {
		const update = this.buildUpdateQuery(
			"memory_syntheses",
			{ id: oldSynthesisId },
			{
				is_active: false,
				superseded_by: newSynthesisId,
			},
		);

		if (!update) {
			return false;
		}

		await this.executeRun(update.query, update.values);
		return true;
	}

	public async deleteSynthesis(synthesisId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("memory_syntheses", {
			id: synthesisId,
		});
		await this.executeRun(query, values);
		return true;
	}

	public async countMemoriesSince(
		userId: number,
		since?: string,
		namespace = "global",
	): Promise<number> {
		let query: string;
		let values: any[];

		if (since) {
			query = `SELECT COUNT(*) as count FROM memories
               WHERE user_id = ? AND namespace = ? AND is_active = 1 AND created_at > ?`;
			values = [userId, namespace, since];
		} else {
			query = `SELECT COUNT(*) as count FROM memories
               WHERE user_id = ? AND namespace = ? AND is_active = 1`;
			values = [userId, namespace];
		}

		const result = await this.runQuery<{ count: number }>(query, values, true);
		return result?.count || 0;
	}
}

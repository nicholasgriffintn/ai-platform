import { BaseRepository } from "./BaseRepository";

export class EmbeddingRepository extends BaseRepository {
	public async getEmbedding(
		id: string,
		type?: string,
	): Promise<Record<string, unknown> | null> {
		const conditions: Record<string, unknown> = { id };
		if (type) {
			conditions.type = type;
		}

		const { query, values } = this.buildSelectQuery(
			"embedding",
			conditions,
			{
				columns: ["id", "metadata", "type", "title", "content"],
			},
		);

		return this.runQuery<Record<string, unknown>>(query, values, true);
	}

	public async getEmbeddingIdByType(
		id: string,
		type: string,
	): Promise<Record<string, unknown> | null> {
		const { query, values } = this.buildSelectQuery(
			"embedding",
			{ id, type },
			{ columns: ["id"] },
		);
		return this.runQuery<Record<string, unknown>>(query, values, true);
	}

	public async insertEmbedding(
		id: string,
		metadata: Record<string, unknown>,
		title: string,
		content: string,
		type: string,
	): Promise<void> {
		const insert = this.buildInsertQuery(
			"embedding",
			{
				id,
				metadata,
				title,
				content,
				type,
			},
			{ jsonFields: ["metadata"] },
		);

		if (!insert) {
			return;
		}

		await this.executeRun(insert.query, insert.values);
	}

	public async deleteEmbedding(id: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery("embedding", { id });
		await this.executeRun(query, values);
	}
}

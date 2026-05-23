import { BaseRepository } from "./BaseRepository";

type EmbeddingScope = {
	namespace?: string;
	userId?: number | string | null;
};

type EmbeddingLookupOptions = EmbeddingScope & {
	type?: string;
	allowUnscopedFallback?: boolean;
};

const toUserId = (userId: EmbeddingScope["userId"]) => {
	if (userId === undefined || userId === null || userId === "") {
		return undefined;
	}

	const numericUserId = Number(userId);
	return Number.isFinite(numericUserId) ? numericUserId : undefined;
};

export class EmbeddingRepository extends BaseRepository {
	public async getEmbedding(
		id: string,
		typeOrOptions?: string | EmbeddingLookupOptions,
	): Promise<Record<string, unknown> | null> {
		const options =
			typeof typeOrOptions === "string" ? { type: typeOrOptions } : typeOrOptions || {};
		const conditions: Record<string, unknown> = {
			id,
			type: options.type,
			namespace: options.namespace,
			user_id: toUserId(options.userId),
		};

		let embedding = await this.findEmbedding(conditions);
		if (!embedding && options.allowUnscopedFallback && options.namespace) {
			embedding = await this.findEmbedding({
				...conditions,
				namespace: null,
				user_id: null,
			});
		}

		return embedding;
	}

	private async findEmbedding(
		conditions: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> {
		const { query, values } = this.buildSelectQuery("embedding", conditions, {
			columns: ["id", "metadata", "type", "title", "content", "namespace", "user_id"],
		});

		return this.runQuery<Record<string, unknown>>(query, values, true);
	}

	public async getEmbeddingIdByType(
		id: string,
		type: string,
		scope: EmbeddingScope = {},
	): Promise<Record<string, unknown> | null> {
		const { query, values } = this.buildSelectQuery(
			"embedding",
			{
				id,
				type,
				namespace: scope.namespace,
				user_id: toUserId(scope.userId),
			},
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
		scope: EmbeddingScope = {},
	): Promise<void> {
		const insert = this.buildInsertQuery(
			"embedding",
			{
				id,
				metadata,
				title,
				content,
				type,
				namespace: scope.namespace,
				user_id: toUserId(scope.userId),
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

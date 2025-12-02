import type {
	Ai,
	VectorFloatArray,
	Vectorize,
} from "@cloudflare/workers-types";

import { gatewayId } from "~/constants/app";
import type { RepositoryManager } from "~/repositories";
import type {
	EmbeddingMutationResult,
	EmbeddingProvider,
	EmbeddingQueryResult,
	EmbeddingVector,
	RagOptions,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/embedding/vectorize" });

export interface VectorizeEmbeddingProviderConfig {
	ai: Ai;
	vector_db: Vectorize;
	repositories: RepositoryManager;
}

export class VectorizeEmbeddingProvider implements EmbeddingProvider {
	private ai: Ai;
	private vector_db: Vectorize;
	private repositories: RepositoryManager;

	constructor(config: VectorizeEmbeddingProviderConfig) {
		this.ai = config.ai;
		this.repositories = config.repositories;
		this.vector_db = config.vector_db;
	}

	async generate(
		type: string,
		content: string,
		id: string,
		metadata: Record<string, string>,
	): Promise<EmbeddingVector[]> {
		try {
			if (!type || !content || !id) {
				throw new AssistantError(
					"Missing type, content or id from request",
					ErrorType.PARAMS_ERROR,
				);
			}

			logger.debug("Generating embeddings with Vectorize", { type, id });

			const response = await this.ai.run(
				"@cf/baai/bge-large-en-v1.5",
				{ text: [content] },
				{
					gateway: {
						id: gatewayId,
						skipCache: false,
						cacheTtl: 259200, // 3 days
					},
				},
			);

			// @ts-ignore
			if (!response.data) {
				throw new AssistantError("No data returned from Vectorize API");
			}

			const mergedMetadata = { ...metadata, type };

			// @ts-ignore
			const data = response.data.map((vector: number[]) => ({
				id,
				values: vector,
				metadata: mergedMetadata,
			}));

			logger.debug("Vectorize embedding generation result", {
				id,
				values: data[0].values,
			});

			return data;
		} catch (error) {
			logger.error("Vectorize Embedding API error:", { error });
			throw error;
		}
	}

	async insert(
		embeddings: EmbeddingVector[],
		options: RagOptions = {},
	): Promise<EmbeddingMutationResult> {
		try {
			logger.debug("Inserting embeddings into Vectorize Vector DB", {
				count: embeddings.length,
			});

			await this.vector_db.upsert(
				embeddings.map((embedding) => ({
					id: embedding.id,
					values: embedding.values,
					metadata: embedding.metadata,
					namespace: options.namespace || "assistant-embeddings",
				})),
			);

			logger.debug("Vectorize Vector DB upsert response", {
				status: "success",
			});

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to insert Vectorize embeddings", { error });
			throw error instanceof Error
				? error
				: new AssistantError("Vector DB insert failed");
		}
	}

	async delete(ids: string[]) {
		try {
			logger.debug("Deleting embeddings from Vectorize Vector DB", { ids });
			await this.vector_db.deleteByIds(ids);

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to delete Vectorize embeddings", { error, ids });
			throw error instanceof Error
				? error
				: new AssistantError("Vector DB delete failed");
		}
	}

	async getQuery(
		query: string,
	): Promise<{ data: any; status: { success: boolean } }> {
		logger.debug("Generating query embedding with Vectorize", { query });
		const response = await this.ai.run(
			"@cf/baai/bge-large-en-v1.5",
			{ text: [query] },
			{
				gateway: {
					id: gatewayId,
					skipCache: false,
					cacheTtl: 259200, // 3 days
				},
			},
		);

		// @ts-ignore
		if (!response.data) {
			throw new AssistantError("No data returned from Vectorize API");
		}

		logger.debug("Vectorize query embedding result", { query });

		return {
			// @ts-ignore
			data: response.data,
			status: { success: true },
		};
	}

	async getMatches(
		queryVector: VectorFloatArray,
		options: RagOptions = {},
	): Promise<EmbeddingQueryResult> {
		logger.debug("Querying Vectorize Vector DB", { queryVector });
		const matches = await this.vector_db.query(queryVector, {
			topK: options.topK ?? 15,
			returnValues: options.returnValues ?? false,
			returnMetadata: options.returnMetadata ?? "none",
			namespace: options.namespace || "assistant-embeddings",
		});

		logger.debug("Vectorize Vector DB query response", { matches });

		return {
			matches:
				matches.matches?.map((match) => ({
					id: match.id,
					score: match.score || 0,
					metadata: match.metadata || {},
				})) || [],
			count: matches.matches?.length || 0,
		};
	}

	async searchSimilar(query: string, options: RagOptions = {}) {
		logger.debug("Searching for similar embeddings in Vectorize", { query });
		const queryVector = await this.getQuery(query);

		if (!queryVector.data) {
			throw new AssistantError("No embedding data found", ErrorType.NOT_FOUND);
		}

		const matches = await this.vector_db.query(queryVector.data[0], {
			topK: options.topK ?? 15,
			returnValues: options.returnValues ?? false,
			returnMetadata: options.returnMetadata ?? "none",
			namespace: options.namespace || "assistant-embeddings",
		});

		if (!matches.matches?.length) {
			throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
		}

		const filteredMatches = matches.matches
			.filter((match) => match.score >= (options.scoreThreshold || 0))
			.slice(0, options.topK || 3);

		const matchesWithContent = await Promise.all(
			filteredMatches.map(async (match) => {
				const record = await this.repositories.embeddings.getEmbedding(
					match.id,
					options.type,
				);

				return {
					match_id: match.id,
					id: record?.id as string,
					title: record?.title as string,
					content: record?.content as string,
					metadata: {
						...match.metadata,
						...(record?.metadata as Record<string, any>),
					},
					score: match.score || 0,
					type: (record?.type as string) || (match.metadata?.type as string),
				};
			}),
		);

		logger.debug("Vectorize search similar embeddings result", { query });

		return matchesWithContent;
	}
}

import type { VectorFloatArray, Vectorize } from "@cloudflare/workers-types";

import type {
	EmbeddingMutationResult,
	EmbeddingProvider,
	EmbeddingQueryResult,
	EmbeddingVector,
	IEnv,
	IUser,
	RagOptions,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { getModelConfig } from "~/lib/providers/models";
import { getChatProvider } from "../../chat";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/embedding/mistral" });

interface MistralProviderResponse {
	data: {
		object: string;
		index: number;
		embedding: number[] | Float32Array;
	}[];
}

export interface MistralEmbeddingProviderConfig {
	vector_db: Vectorize;
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
	private vector_db: Vectorize;
	private env: IEnv;
	private user?: IUser;

	constructor(config: MistralEmbeddingProviderConfig, env: IEnv, user?: IUser) {
		this.vector_db = config.vector_db;
		this.env = env;
		this.user = user;
	}

	async fetchEmbedding(content: string, model: string) {
		const trimmedContent = content.trim();
		if (!trimmedContent.length) {
			throw new AssistantError(
				"Empty content provided for embedding",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Fetching embedding from Mistral", { model });

		const mistralModelConfig = await getModelConfig(model);
		const mistralProvider = getChatProvider(mistralModelConfig.provider, {
			env: this.env,
			user: this.user,
		});

		const response = await mistralProvider.getResponse(
			{
				model: mistralModelConfig.matchingModel,
				env: this.env,
				user: this.user,
				body: {
					input: trimmedContent,
				},
			},
			this.user?.id,
		);

		let mistralResponse: MistralProviderResponse;
		const responseData = response;

		if (typeof responseData === "string") {
			mistralResponse = safeParseJson(responseData);
			if (!mistralResponse) {
				throw new AssistantError(
					"Invalid JSON response from Mistral",
					ErrorType.EXTERNAL_API_ERROR,
				);
			}
		} else if (responseData && typeof responseData === "object") {
			mistralResponse = responseData as MistralProviderResponse;
		} else {
			throw new AssistantError(
				"Invalid response format from Mistral",
				ErrorType.EXTERNAL_API_ERROR,
			);
		}

		if (
			!mistralResponse.data?.length ||
			!Array.isArray(mistralResponse.data?.[0].embedding)
		) {
			throw new AssistantError(
				"Invalid embedding format from Mistral",
				ErrorType.EXTERNAL_API_ERROR,
			);
		}

		logger.debug("Mistral embedding generation result", {
			values: mistralResponse.data[0].embedding,
		});

		return mistralResponse;
	}

	async generate(
		type: string,
		content: string,
		id: string,
		metadata: Record<string, any>,
	): Promise<EmbeddingVector[]> {
		if (!type || !content || !id) {
			throw new AssistantError(
				"Missing type, content or id from request",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Generating embeddings with Mistral", { type, id });

		const mistralModelName =
			type === "code" ? "codestral-embed" : "mistral-embed";
		const mistralResponse = await this.fetchEmbedding(
			content,
			mistralModelName,
		);

		const mergedMetadata = {
			...metadata,
			type,
			source: "mistral",
		};

		logger.debug("Mistral embedding generation result", {
			id,
			values: mistralResponse.data[0].embedding,
		});

		return [
			{
				id,
				values: mistralResponse.data[0].embedding,
				metadata: mergedMetadata,
			},
		];
	}

	async insert(
		embeddings: EmbeddingVector[],
		options: RagOptions = {},
	): Promise<EmbeddingMutationResult> {
		try {
			logger.debug("Inserting embeddings into Mistral Vector DB", {
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

			logger.debug("Mistral Vector DB upsert response", {
				status: "success",
			});

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to insert Mistral embeddings", { error });
			return {
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async delete(ids: string[]): Promise<EmbeddingMutationResult> {
		try {
			logger.debug("Deleting embeddings from Mistral Vector DB", { ids });

			await this.vector_db.deleteByIds(ids);

			logger.debug("Mistral Vector DB delete response", { status: "success" });

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to delete embeddings", { error, ids });
			return {
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getQuery(
		query: string,
	): Promise<{ data: any; status: { success: boolean } }> {
		if (!query?.trim()) {
			throw new AssistantError(
				"Empty query provided for embeddings search",
				ErrorType.PARAMS_ERROR,
			);
		}

		const mistralModelName = "mistral-embed";
		const mistralResponse = await this.fetchEmbedding(query, mistralModelName);

		return {
			data: [mistralResponse.data[0].embedding],
			status: { success: true },
		};
	}

	async getMatches(
		queryVector: VectorFloatArray,
		options: RagOptions = {},
	): Promise<EmbeddingQueryResult> {
		logger.debug("Querying Mistral Vector DB", { queryVector, options });

		const matches = await this.vector_db.query(queryVector, {
			topK: options.topK ?? 15,
			returnValues: options.returnValues ?? false,
			returnMetadata: options.returnMetadata ?? "none",
			namespace: options.namespace || "assistant-embeddings",
			filter: options.filter,
		});

		logger.debug("Mistral Vector DB query response", { matches });

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

	async searchSimilar(
		query: string,
		options: RagOptions = {},
	): Promise<
		{
			title: string;
			content: string;
			metadata: Record<string, any>;
			score: number;
			type: string;
		}[]
	> {
		if (!query?.trim()) {
			throw new AssistantError(
				"Empty query provided for embeddings search",
				ErrorType.PARAMS_ERROR,
			);
		}

		logger.debug("Generating embeddings with Mistral");

		const mistralModelName = "mistral-embed";
		const mistralResponse = await this.fetchEmbedding(query, mistralModelName);

		const matches = await this.vector_db.query(
			mistralResponse.data[0].embedding,
			{
				topK: options.topK ?? 15,
				returnValues: options.returnValues ?? false,
				returnMetadata: options.returnMetadata ?? "none",
				namespace: options.namespace || "assistant-embeddings",
				filter: options.filter,
			},
		);

		if (!matches.matches?.length) {
			throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
		}

		const data = matches.matches
			.filter((match) => match.score >= (options.scoreThreshold || 0))
			.slice(0, options.topK || 3)
			.map((match) => ({
				title: (match.metadata?.title as string) || match.id,
				content: (match.metadata?.content as string) || "",
				metadata: match.metadata || {},
				score: match.score || 0,
				type: (match.metadata?.type as string) || options.type || "unknown",
			}));

		logger.debug("Mistral Vector DB query result", { data });

		return data;
	}
}

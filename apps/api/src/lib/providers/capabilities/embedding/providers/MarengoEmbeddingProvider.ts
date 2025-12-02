import type { Vectorize } from "@cloudflare/workers-types";

import { getModelConfig } from "~/lib/providers/models";
import { getChatProvider } from "../../chat";
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
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/embedding/marengo" });

export interface MarengoEmbeddingProviderConfig {
	vector_db: Vectorize;
}

interface MarengoResponse {
	embedding: number[];
	embeddingOption: any;
	startSec: number | null;
	endSec: number | null;
}

export class MarengoEmbeddingProvider implements EmbeddingProvider {
	private vector_db: Vectorize;
	private env: IEnv;
	private user?: IUser;

	constructor(config: MarengoEmbeddingProviderConfig, env: IEnv, user?: IUser) {
		this.vector_db = config.vector_db;
		this.env = env;
		this.user = user;
	}

	async generate(
		type: string,
		content: string,
		id: string,
		metadata: Record<string, any>,
	): Promise<EmbeddingVector[]> {
		try {
			if (!type || !content || !id) {
				throw new AssistantError(
					"Missing type, content or id from request",
					ErrorType.PARAMS_ERROR,
				);
			}

			logger.debug("Generating embeddings with Marengo", { type, id });

			const marengoModelName = "marengo-embed";
			const marengoModelConfig = await getModelConfig(marengoModelName);
			const marengoProvider = getChatProvider(marengoModelConfig.provider, {
				env: this.env,
				user: this.user,
			});

			let requestContent: any[] = [{ type: "text", text: content }];

			if (metadata.url && type === "video") {
				requestContent.push({
					type: "video_url",
					video_url: { url: metadata.url },
				});
			}

			const response = await marengoProvider.getResponse(
				{
					model: marengoModelConfig.matchingModel,
					env: this.env,
					user: this.user,
					messages: [
						{
							role: "user",
							content: requestContent,
						},
					],
				},
				this.user?.id,
			);

			let marengoResponse: MarengoResponse;
			const responseData = response.response;

			if (typeof responseData === "string") {
				marengoResponse = safeParseJson(responseData);
				if (!marengoResponse) {
					throw new AssistantError(
						"Invalid JSON response from Marengo",
						ErrorType.EXTERNAL_API_ERROR,
					);
				}
			} else if (responseData && typeof responseData === "object") {
				marengoResponse = responseData as MarengoResponse;
			} else {
				throw new AssistantError(
					"Invalid response format from Marengo",
					ErrorType.EXTERNAL_API_ERROR,
				);
			}

			if (
				!marengoResponse.embedding ||
				!Array.isArray(marengoResponse.embedding)
			) {
				throw new AssistantError(
					"Invalid embedding format from Marengo",
					ErrorType.EXTERNAL_API_ERROR,
				);
			}

			const mergedMetadata = {
				...metadata,
				type,
				source: "marengo",
				startSec: marengoResponse.startSec,
				endSec: marengoResponse.endSec,
				embeddingOption: marengoResponse.embeddingOption,
			};

			logger.debug("Marengo embedding generation result", {
				id,
				values: marengoResponse.embedding,
				metadata: mergedMetadata,
			});

			return [
				{
					id,
					values: marengoResponse.embedding,
					metadata: mergedMetadata,
				},
			];
		} catch (error) {
			logger.error("Marengo Embedding API error:", { error });
			throw error instanceof AssistantError
				? error
				: new AssistantError(
						`Marengo embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
						ErrorType.EXTERNAL_API_ERROR,
					);
		}
	}

	async insert(
		embeddings: EmbeddingVector[],
		options: RagOptions = {},
	): Promise<EmbeddingMutationResult> {
		try {
			logger.debug("Inserting embeddings into Marengo Vector DB", {
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

			logger.debug("Marengo Vector DB upsert response", {
				status: "success",
			});

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to insert embeddings:", { error });
			return {
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async delete(ids: string[]): Promise<EmbeddingMutationResult> {
		try {
			await this.vector_db.deleteByIds(ids);

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("Failed to delete embeddings:", { error, ids });
			return {
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getQuery(
		_query: string,
	): Promise<{ data: any; status: { success: boolean } }> {
		throw new AssistantError(
			"Query operation not supported by Marengo provider",
			ErrorType.NOT_FOUND,
		);
	}

	async getMatches(
		_queryVector: any,
		_options: RagOptions = {},
	): Promise<EmbeddingQueryResult> {
		throw new AssistantError(
			"Match operation not supported by Marengo provider",
			ErrorType.NOT_FOUND,
		);
	}

	async searchSimilar(
		_query: string,
		_options?: RagOptions,
	): Promise<
		{
			title: string;
			content: string;
			metadata: Record<string, any>;
			score: number;
			type: string;
		}[]
	> {
		throw new AssistantError(
			"Search operation not supported by Marengo provider",
			ErrorType.NOT_FOUND,
		);
	}
}

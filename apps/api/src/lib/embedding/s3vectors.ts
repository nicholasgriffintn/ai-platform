import { AwsClient } from "aws4fetch";
import type { Ai } from "@cloudflare/workers-types";

import { gatewayId } from "~/constants/app";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
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

const logger = getLogger({ prefix: "lib/embedding/s3vectors" });

export interface S3VectorsEmbeddingProviderConfig {
	bucketName: string;
	indexName?: string;
	region?: string;
	accessKeyId: string;
	secretAccessKey: string;
	ai: Ai;
}

export class S3VectorsEmbeddingProvider implements EmbeddingProvider {
	private bucketName: string;
	private indexName?: string;
	private region: string;
	private endpoint: string;
	private env: IEnv;
	private user?: IUser;
	private defaultAccessKeyId: string;
	private defaultSecretAccessKey: string;
	private ai: Ai;

	constructor(
		config: S3VectorsEmbeddingProviderConfig,
		env: IEnv,
		user?: IUser,
	) {
		this.bucketName = config.bucketName;
		this.indexName = config.indexName;
		this.region = config.region || "us-east-1";
		this.endpoint = `https://s3vectors.${this.region}.api.aws`;
		this.env = env;
		this.user = user;
		this.defaultAccessKeyId = config.accessKeyId || "";
		this.defaultSecretAccessKey = config.secretAccessKey || "";
		this.ai = config.ai;
	}

	private parseAwsCredentials(apiKey: string): {
		accessKey: string;
		secretKey: string;
	} {
		const delimiter = "::@@::";
		const parts = apiKey.split(delimiter);

		if (parts.length !== 2) {
			throw new AssistantError(
				"Invalid AWS credentials format",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return { accessKey: parts[0], secretKey: parts[1] };
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

			const response = await this.ai.run(
				"@cf/baai/bge-base-en-v1.5",
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
				throw new AssistantError("No data returned from embedding model");
			}

			// @ts-ignore
			return response.data.map((vector: number[]) => ({
				id,
				values: vector,
				metadata: { ...metadata, type, content },
			}));
		} catch (error) {
			logger.error("S3 Vectors Embedding API error:", { error });
			throw error;
		}
	}

	async getAwsClient() {
		let accessKeyId = this.defaultAccessKeyId;
		let secretAccessKey = this.defaultSecretAccessKey;

		if (this.user?.id && this.env.DB) {
			try {
				const userSettingsRepo = new UserSettingsRepository(this.env);
				const userApiKey = await userSettingsRepo.getProviderApiKey(
					this.user.id,
					"bedrock",
				);

				if (userApiKey) {
					const credentials = this.parseAwsCredentials(userApiKey);
					accessKeyId = credentials.accessKey;
					secretAccessKey = credentials.secretKey;
				}
			} catch (error) {
				logger.warn("Failed to get user API key for s3vectors:", { error });
			}
		}

		if (!accessKeyId || !secretAccessKey) {
			throw new AssistantError(
				"No valid credentials found",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const aws = new AwsClient({
			accessKeyId,
			secretAccessKey,
			region: this.region,
			service: "s3vectors",
		});

		return aws;
	}

	async insert(
		embeddings: EmbeddingVector[],
		_options: RagOptions = {},
	): Promise<EmbeddingMutationResult> {
		const url = `${this.endpoint}/PutVectors`;

		const vectors = embeddings.map((embedding) => ({
			key: embedding.id,
			data: {
				float32: embedding.values,
			},
			metadata: embedding.metadata,
		}));

		const body = JSON.stringify({
			vectorBucketName: this.bucketName,
			indexName: this.indexName,
			vectors,
		});

		const aws = await this.getAwsClient();
		const response = await aws.fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new AssistantError(
				`S3 Vectors API error: ${response.statusText} - ${errorText}`,
				ErrorType.PROVIDER_ERROR,
				response.status,
			);
		}

		return {
			status: "success",
			error: null,
		};
	}

	async delete(
		ids: string[],
	): Promise<{ status: string; error: string | null }> {
		const url = `${this.endpoint}/DeleteVectors`;

		const body = JSON.stringify({
			vectorBucketName: this.bucketName,
			indexName: this.indexName,
			keys: ids,
		});

		try {
			const aws = await this.getAwsClient();
			const response = await aws.fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new AssistantError(
					`S3 Vectors API error: ${response.statusText} - ${errorText}`,
					ErrorType.PROVIDER_ERROR,
					response.status,
				);
			}

			return {
				status: "success",
				error: null,
			};
		} catch (error) {
			logger.error("S3 Vectors delete error:", { error });
			return {
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getQuery(
		query: string,
	): Promise<{ data: any; status: { success: boolean } }> {
		const response = await this.ai.run(
			"@cf/baai/bge-base-en-v1.5",
			{ text: [query] },
			{
				gateway: {
					id: gatewayId,
					skipCache: false,
					cacheTtl: 259200, // 3 days
				},
			},
		);

		return {
			// @ts-ignore
			data: response.data,
			status: { success: true },
		};
	}

	async getMatches(
		queryVector: number[],
		options: RagOptions = {},
	): Promise<EmbeddingQueryResult> {
		const url = `${this.endpoint}/QueryVectors`;

		const request: Record<string, any> = {
			vectorBucketName: this.bucketName,
			topK: options.topK ?? 15,
			returnDistance: true,
			returnMetadata: true,
			queryVector: {
				float32: queryVector,
			},
		};

		if (this.indexName) {
			request.indexName = this.indexName;
		}

		if (options.filter) {
			request.filter = options.filter;
		}

		const body = JSON.stringify(request);

		const aws = await this.getAwsClient();
		const response = await aws.fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new AssistantError(
				`S3 Vectors API error: ${response.statusText} - ${errorText}`,
				ErrorType.PROVIDER_ERROR,
				response.status,
			);
		}

		const data = (await response.json()) as any;

		return {
			matches:
				data.vectors?.map((vector: any) => ({
					id: vector.key,
					score: 1 - (vector.distance || 0),
					title: vector.metadata?.title || "",
					content: vector.metadata?.content || "",
					metadata: vector.metadata || {},
				})) || [],
			count: data.vectors?.length || 0,
		};
	}

	async searchSimilar(query: string, options: RagOptions = {}) {
		const queryVector = await this.getQuery(query);

		if (!queryVector.data) {
			throw new AssistantError("No embedding data found", ErrorType.NOT_FOUND);
		}

		const matchesResponse = await this.getMatches(queryVector.data[0], options);

		if (!matchesResponse.matches.length) {
			throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
		}

		return matchesResponse.matches.map((match) => ({
			title: match.title || match.metadata?.title || "",
			content: match.content || match.metadata?.content || "",
			metadata: match.metadata || {},
			score: match.score,
			type: match.metadata?.type || "text",
		}));
	}
}

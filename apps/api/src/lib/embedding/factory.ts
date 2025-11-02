import type { EmbeddingProvider, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	BedrockEmbeddingProvider,
	type BedrockEmbeddingProviderConfig,
} from "./bedrock";
import {
	MarengoEmbeddingProvider,
	type MarengoEmbeddingProviderConfig,
} from "./marengo";
import {
	MistralEmbeddingProvider,
	type MistralEmbeddingProviderConfig,
} from "./mistral";
import {
	S3VectorsEmbeddingProvider,
	type S3VectorsEmbeddingProviderConfig,
} from "./s3vectors";
import {
	VectorizeEmbeddingProvider,
	type VectorizeEmbeddingProviderConfig,
} from "./vectorize";

export class EmbeddingProviderFactory {
	static getProvider(
		type: string,
		config:
			| VectorizeEmbeddingProviderConfig
			| BedrockEmbeddingProviderConfig
			| MarengoEmbeddingProviderConfig
			| MistralEmbeddingProviderConfig
			| S3VectorsEmbeddingProviderConfig,
		env: IEnv,
		user?: IUser,
	): EmbeddingProvider {
		switch (type) {
			case "bedrock":
				if (!("knowledgeBaseId" in config)) {
					throw new AssistantError(
						"Invalid config for Bedrock provider",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return new BedrockEmbeddingProvider(config, env, user);
			case "vectorize":
				if (
					!("ai" in config) ||
					!("vector_db" in config) ||
					!("database" in config)
				) {
					throw new AssistantError(
						"Invalid config for Vectorize provider",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return new VectorizeEmbeddingProvider(config);
			case "marengo":
				if (!("vector_db" in config)) {
					throw new AssistantError(
						"Invalid config for Marengo provider",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return new MarengoEmbeddingProvider(config, env, user);
			case "mistral":
				if (!("vector_db" in config)) {
					throw new AssistantError(
						"Invalid config for Mistral provider",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return new MistralEmbeddingProvider(config, env, user);
			case "s3vectors":
				if (!("bucketName" in config)) {
					throw new AssistantError(
						"Invalid config for S3 Vectors provider",
						ErrorType.CONFIGURATION_ERROR,
					);
				}
				return new S3VectorsEmbeddingProvider(config, env, user);
			default:
				throw new AssistantError(
					`Unsupported embedding provider: ${type}`,
					ErrorType.PARAMS_ERROR,
				);
		}
	}
}

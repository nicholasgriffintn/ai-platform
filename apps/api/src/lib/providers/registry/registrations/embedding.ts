import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { EmbeddingProvider } from "~/types";
import {
	BedrockEmbeddingProvider,
	type BedrockEmbeddingProviderConfig,
	MarengoEmbeddingProvider,
	type MarengoEmbeddingProviderConfig,
	MistralEmbeddingProvider,
	type MistralEmbeddingProviderConfig,
	S3VectorsEmbeddingProvider,
	type S3VectorsEmbeddingProviderConfig,
	VectorizeEmbeddingProvider,
	type VectorizeEmbeddingProviderConfig,
} from "../../capabilities/embedding/providers";
import { ensureConfig, ensureEnv, ensureUser } from "./utils";

const embeddingProviders: ProviderRegistration<EmbeddingProvider>[] = [
	{
		name: "bedrock",
		lifecycle: "transient",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			const config = ensureConfig<BedrockEmbeddingProviderConfig>(
				context,
				"Bedrock embedding provider requires a knowledge base config",
			);

			return new BedrockEmbeddingProvider(config, env, user);
		},
		metadata: { vendor: "AWS", categories: ["embedding"] },
	},
	{
		name: "vectorize",
		lifecycle: "transient",
		create: (context) => {
			const config = ensureConfig<VectorizeEmbeddingProviderConfig>(
				context,
				"Vectorize provider requires AI, Vector DB, and Database config",
			);

			return new VectorizeEmbeddingProvider(config);
		},
		metadata: { vendor: "Cloudflare", categories: ["embedding"] },
	},
	{
		name: "marengo",
		lifecycle: "transient",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			const config = ensureConfig<MarengoEmbeddingProviderConfig>(
				context,
				"Marengo provider requires a vector database config",
			);

			return new MarengoEmbeddingProvider(config, env, user);
		},
		metadata: { vendor: "Marengo", categories: ["embedding"] },
	},
	{
		name: "mistral",
		lifecycle: "transient",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			const config = ensureConfig<MistralEmbeddingProviderConfig>(
				context,
				"Mistral embedding provider requires a vector database config",
			);

			return new MistralEmbeddingProvider(config, env, user);
		},
		metadata: { vendor: "Mistral", categories: ["embedding"] },
	},
	{
		name: "s3vectors",
		lifecycle: "transient",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			const config = ensureConfig<S3VectorsEmbeddingProviderConfig>(
				context,
				"S3 vectors provider requires a bucket configuration",
			);

			return new S3VectorsEmbeddingProvider(config, env, user);
		},
		metadata: { vendor: "AWS S3", categories: ["embedding"] },
	},
];

export function registerEmbeddingProviders(registry: ProviderRegistry): void {
	for (const registration of embeddingProviders) {
		registry.register("embedding", registration);
	}
}

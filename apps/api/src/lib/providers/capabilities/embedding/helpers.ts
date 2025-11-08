import type {
	EmbeddingProvider,
	IEnv,
	IUser,
	IUserSettings,
	RagOptions,
} from "~/types";
import { RepositoryManager } from "~/repositories";
import { getAuxiliaryModel } from "~/lib/models";
import { trackRagMetrics } from "~/lib/monitoring";
import { getChatProvider } from "../chat";
import { providerLibrary } from "../../library";
import { AssistantError } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/embedding/helpers" });
const DEFAULT_SCORE_THRESHOLD = 0.7;
const DEFAULT_RERANK_CANDIDATES = 10;
const DEFAULT_SUMMARY_THRESHOLD = 750;

/**
 * Get an embedding provider based on user settings.
 * This replaces the Embedding.getInstance() pattern.
 */
export function getEmbeddingProvider(
	env: IEnv,
	user?: IUser,
	userSettings?: IUserSettings,
): EmbeddingProvider {
	const providerName = userSettings?.embedding_provider || "vectorize";

	switch (providerName) {
		case "bedrock": {
			if (
				!userSettings?.bedrock_knowledge_base_id ||
				!userSettings?.bedrock_knowledge_base_custom_data_source_id
			) {
				throw new AssistantError(
					"Missing required AWS credentials or knowledge base IDs",
				);
			}

			const config = {
				knowledgeBaseId: userSettings.bedrock_knowledge_base_id,
				knowledgeBaseCustomDataSourceId:
					userSettings.bedrock_knowledge_base_custom_data_source_id,
				region: env.AWS_REGION || "us-east-1",
				accessKeyId: env.BEDROCK_AWS_ACCESS_KEY || "",
				secretAccessKey: env.BEDROCK_AWS_SECRET_KEY || "",
			};

			return providerLibrary.embedding("bedrock", { env, user, config });
		}
		case "s3vectors": {
			if (!userSettings?.s3vectors_bucket_name) {
				throw new AssistantError("Missing required S3 vectors bucket name");
			}

			const config = {
				bucketName: userSettings.s3vectors_bucket_name,
				indexName: userSettings.s3vectors_index_name || undefined,
				region: userSettings.s3vectors_region || env.AWS_REGION || "us-east-1",
				accessKeyId: env.S3VECTORS_AWS_ACCESS_KEY || "",
				secretAccessKey: env.S3VECTORS_AWS_SECRET_KEY || "",
				ai: env.AI,
			};

			return providerLibrary.embedding("s3vectors", { env, user, config });
		}
		case "vectorize": {
			if (!env.AI || !env.VECTOR_DB) {
				throw new AssistantError(
					"Vectorize embeddings require AI and Vectorize bindings",
				);
			}

			const repositories = new RepositoryManager(env);
			const config = {
				ai: env.AI,
				vector_db: env.VECTOR_DB,
				repositories,
			};

			return providerLibrary.embedding("vectorize", { env, user, config });
		}
		default: {
			if (!env.VECTOR_DB) {
				throw new AssistantError(
					"Embedding provider requires a Vectorize binding",
				);
			}

			const config = { vector_db: env.VECTOR_DB };
			return providerLibrary.embedding(providerName, { env, user, config });
		}
	}
}

/**
 * Get the namespace for embedding operations based on user and options.
 */
export function getEmbeddingNamespace(
	user?: IUser,
	options?: RagOptions,
): string {
	if (options?.namespace) {
		const requested = options.namespace;

		if (
			user?.id &&
			(requested.startsWith("user_kb_") ||
				requested.startsWith("memory_user_")) &&
			!requested.endsWith(user.id.toString())
		) {
			return "kb";
		}

		return requested;
	}

	if (user?.id) {
		return `user_kb_${user.id}`;
	}

	return "kb";
}

/**
 * Augment a prompt with relevant context from the embedding provider.
 */
export async function augmentPrompt({
	provider,
	query,
	options = {},
	env,
	user,
}: {
	provider: EmbeddingProvider;
	query: string;
	options?: RagOptions;
	env: IEnv;
	user?: IUser;
}) {
	logger.debug("augmentPrompt called", { query, options, userId: user?.id });

	try {
		const namespace = getEmbeddingNamespace(user, options);
		const trimmedQuery = query.trim();
		const topK =
			options.topK ??
			(trimmedQuery.length > 0 && trimmedQuery.length < 20 ? 1 : 3);
		const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
		const rerankCandidates =
			(options as any).rerankCandidates ??
			Math.max(DEFAULT_RERANK_CANDIDATES, topK * 2);

		const docs = await trackRagMetrics(
			() =>
				provider.searchSimilar(trimmedQuery, {
					topK: rerankCandidates,
					scoreThreshold,
					type: options.type,
					namespace,
				}),
			env?.ANALYTICS,
			{ query: trimmedQuery, method: "augment_prompt_search" },
			user?.id,
		);

		logger.debug("augmentPrompt retrieved docs", {
			count: docs.length,
			topK,
		});

		if (!docs || docs.length === 0) {
			return "";
		}

		let ranked = docs;

		// Rerank if we have more docs than needed
		if (docs.length > topK) {
			try {
				const reranker = getChatProvider("workers", { env, user });
				const docsWithId = docs.map((d) => ({ id: d.id, content: d.content }));
				const rerankPrompt = `Rerank the following contexts by relevance to the query "${trimmedQuery}". Return a JSON array of IDs in descending order of relevance.\n${JSON.stringify(
					docsWithId,
					null,
					2,
				)}`;

				logger.debug("augmentPrompt reranking", { rerankPrompt });

				const response = await reranker.getResponse({
					env,
					model: "bge-reranker-base",
					messages: [{ role: "user", content: rerankPrompt }],
				});

				const rankedIds =
					safeParseJson<string[]>(response.content || response.response) || [];
				const reordered = rankedIds
					.map((id) => docs.find((doc) => doc.id === id))
					.filter(Boolean);

				if (reordered.length) {
					ranked = reordered as typeof docs;
				}

				logger.debug("augmentPrompt reranked", { ranked });
			} catch (error) {
				logger.warn("augmentPrompt reranking failed, using original order", {
					error,
				});
				ranked = docs;
			}
		}

		const selected = ranked.slice(0, topK);
		logger.debug("augmentPrompt selected", { selected });

		const summaryThreshold =
			options.summaryThreshold || DEFAULT_SUMMARY_THRESHOLD;

		// Summarize long documents
		for (const doc of selected) {
			if (doc.content.length > summaryThreshold) {
				try {
					const { model: modelToUse, provider: providerToUse } =
						await getAuxiliaryModel(env, user);
					const summarizer = getChatProvider(providerToUse, { env, user });
					const sumPrompt = `Summarize the following context into a concise paragraph (no more than 100 words):\n\n${doc.content}`;
					const sumRes: any = await summarizer.getResponse({
						env,
						model: modelToUse,
						messages: [{ role: "user", content: sumPrompt }],
					});
					doc.content = sumRes.content || sumRes.response || doc.content;
					logger.debug("augmentPrompt summarized", { doc });
				} catch (error) {
					logger.warn("augmentPrompt summarization failed, using original", {
						error,
					});
				}
			}
		}

		const contexts = selected.map((doc) => ({
			id: doc.id,
			type: doc.type,
			title: doc.title,
			score: doc.score,
			content: doc.content,
		}));

		const prompt = `
Contexts (JSON array):
+---------------------
${JSON.stringify(contexts, null, 2)}
+---------------------
Answer the query "${trimmedQuery}" using *only* these contexts.
`.trim();

		logger.debug("augmentPrompt prompt", { prompt });
		return prompt;
	} catch (error) {
		logger.error("augmentPrompt error", { error });
		return "";
	}
}

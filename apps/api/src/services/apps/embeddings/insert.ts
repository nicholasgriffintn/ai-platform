import { sanitiseInput } from "~/lib/chat/utils";
import { RepositoryManager } from "~/repositories";
import {
	getEmbeddingProvider,
	getEmbeddingNamespace,
} from "~/lib/providers/capabilities/embedding/helpers";
import type { EmbeddingProvider, EmbeddingVector, IRequest, RagOptions } from "~/types";
import { chunkText } from "~/utils/embeddings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/embeddings/insert" });

type PendingEmbeddingRecord = {
	id: string;
	metadata: Record<string, any>;
	title: string;
	content: string;
	type: string;
};

// @ts-ignore
export interface IInsertEmbeddingRequest extends IRequest {
	request: {
		type: string;
		content?: string;
		file?: {
			data: any;
			mimeType: string;
		};
		id: string;
		metadata: Record<string, any>;
		title: string;
		rag_options: RagOptions;
	};
}

export const insertEmbedding = async (req: IInsertEmbeddingRequest): Promise<any> => {
	try {
		const { request, env } = req;

		const {
			type,
			content: requestContent,
			file,
			id,
			metadata,
			title: requestTitle,
			rag_options = {},
		} = request;

		let content: string;

		if (requestContent) {
			content = sanitiseInput(requestContent);
		}

		const title = requestTitle ? sanitiseInput(requestTitle) : "";

		if (!type) {
			throw new AssistantError("Missing type from request", ErrorType.PARAMS_ERROR);
		}
		if (!content) {
			throw new AssistantError("Missing content from request", ErrorType.PARAMS_ERROR);
		}

		const repositories = new RepositoryManager(env);
		const userSettings = req.user?.id
			? await repositories.userSettings.getUserSettings(req.user.id)
			: null;
		if (!userSettings) {
			throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
		}

		const finalNamespace = getEmbeddingNamespace(req.user, {
			namespace: rag_options?.namespace,
		});
		const embeddingScope = {
			namespace: finalNamespace,
			userId: req.user?.id,
		};
		const requestMetadata = metadata ?? {};
		const scopedMetadata = {
			...requestMetadata,
			title,
			namespace: finalNamespace,
			...(req.user?.id && { userId: req.user.id.toString() }),
		};

		let uniqueId;
		const newMetadata = {
			...scopedMetadata,
			...(file && { fileData: file.data, mimeType: file.mimeType }),
		};

		const pendingDbRecords: PendingEmbeddingRecord[] = [];

		if (type === "blog") {
			const blogExists = await repositories.embeddings.getEmbeddingIdByType(id, "blog");

			if (!blogExists) {
				throw new AssistantError(
					"Blog does not exist. You can only insert blog embeddings for existing blogs.",
					ErrorType.NOT_FOUND,
				);
			}

			uniqueId = id;
		} else {
			uniqueId = id || `${Date.now()}-${generateId()}`;
			pendingDbRecords.push({
				id: uniqueId,
				metadata: newMetadata,
				title,
				content,
				type,
			});
		}

		if (!uniqueId) {
			throw new AssistantError("No unique ID found");
		}

		const embedding = getEmbeddingProvider(env, req.user, userSettings);

		const maxChars = rag_options?.chunkSize || 2000;
		const chunks = chunkText(content, maxChars);
		let allGenerated: EmbeddingVector[] = [];
		if (chunks.length > 1) {
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const chunkId = `${id || uniqueId}-${i}`;
				const chunkMeta = { ...scopedMetadata, chunkIndex: i.toString() };

				pendingDbRecords.push({
					id: chunkId,
					metadata: chunkMeta,
					title: `${title} (chunk ${i})`,
					content: chunk,
					type,
				});

				const vecs = await embedding.generate(type, chunk, chunkId, chunkMeta);
				allGenerated.push(...vecs);
			}
		} else {
			allGenerated = await embedding.generate(type, content, id || uniqueId, scopedMetadata);
		}

		const finalRagOptions = { ...rag_options, namespace: finalNamespace, userId: req.user?.id };
		const inserted = await embedding.insert(allGenerated, finalRagOptions);

		// @ts-ignore
		if (inserted.status !== "success" && !inserted.documentDetails) {
			logger.error("Embedding insertion failed", inserted);
			throw new AssistantError("Embedding insertion failed");
		}

		try {
			await insertEmbeddingRecords(repositories, pendingDbRecords, embeddingScope);
		} catch (error) {
			await cleanupInsertedVectors(embedding, allGenerated);
			throw error;
		}

		return {
			status: "success",
			data: {
				id: uniqueId,
				metadata: { ...requestMetadata, title },
				title,
				content,
				type,
			},
		};
	} catch (error) {
		logger.error("Error inserting embedding", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			errorObject: error,
		});

		throw new AssistantError("Error inserting embedding");
	}
};

async function insertEmbeddingRecords(
	repositories: RepositoryManager,
	records: PendingEmbeddingRecord[],
	scope: { namespace: string; userId?: number | string },
) {
	const insertedIds: string[] = [];

	try {
		for (const record of records) {
			await repositories.embeddings.insertEmbedding(
				record.id,
				record.metadata,
				record.title,
				record.content,
				record.type,
				scope,
			);
			insertedIds.push(record.id);
		}
	} catch (error) {
		await cleanupInsertedEmbeddingRecords(repositories, insertedIds);
		throw error;
	}
}

async function cleanupInsertedEmbeddingRecords(repositories: RepositoryManager, ids: string[]) {
	for (const id of ids) {
		try {
			await repositories.embeddings.deleteEmbedding(id);
		} catch (error) {
			logger.warn("Failed to clean up inserted embedding record after database insert failure", {
				id,
				error,
			});
		}
	}
}

async function cleanupInsertedVectors(embedding: EmbeddingProvider, vectors: EmbeddingVector[]) {
	const ids = vectors.map((vector) => vector.id);
	if (ids.length === 0) {
		return;
	}

	try {
		await embedding.delete(ids);
	} catch (error) {
		logger.warn("Failed to clean up inserted vectors after database insert failure", {
			ids,
			error,
		});
	}
}

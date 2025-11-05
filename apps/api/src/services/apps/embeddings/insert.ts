import { sanitiseInput } from "~/lib/chat/utils";
import { RepositoryManager } from "~/repositories";
import { Embedding } from "~/lib/embedding";
import type { IRequest, RagOptions } from "~/types";
import { chunkText } from "~/utils/embeddings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/embeddings/insert" });

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

// TODO: This still stores in the DB if the vector insertion fails
export const insertEmbedding = async (
	req: IInsertEmbeddingRequest,
): Promise<any> => {
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
			throw new AssistantError(
				"Missing type from request",
				ErrorType.PARAMS_ERROR,
			);
		}
		if (!content) {
			throw new AssistantError(
				"Missing content from request",
				ErrorType.PARAMS_ERROR,
			);
		}

		let uniqueId;
		const newMetadata = {
			...metadata,
			title,
			...(file && { fileData: file.data, mimeType: file.mimeType }),
		};

		const repositories = new RepositoryManager(env);

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

			await repositories.embeddings.insertEmbedding(
				uniqueId,
				newMetadata,
				title,
				content,
				type,
			);
		}

		if (!uniqueId) {
			throw new AssistantError("No unique ID found");
		}

		const userSettings = await repositories.userSettings.getUserSettings(req.user?.id);
		if (!userSettings) {
			throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
		}
		const embedding = Embedding.getInstance(env, req.user, userSettings);

		const finalNamespace = embedding.getNamespace({
			namespace: rag_options?.namespace,
		});

		const maxChars = rag_options?.chunkSize || 2000;
		const chunks = chunkText(content, maxChars);
		let allGenerated: any[] = [];
		if (chunks.length > 1) {
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const chunkId = `${id || uniqueId}-${i}`;
				const chunkMeta = { ...metadata, title, chunkIndex: i.toString() };

				await repositories.embeddings.insertEmbedding(
					chunkId,
					chunkMeta,
					`${title} (chunk ${i})`,
					chunk,
					type,
				);

				const vecs = await embedding.generate(type, chunk, chunkId, chunkMeta);
				allGenerated.push(...vecs);
			}
		} else {
			allGenerated = await embedding.generate(type, content, id || uniqueId, {
				...metadata,
				title,
			});
		}
		const generated = await embedding.generate(
			type,
			content,
			uniqueId,
			newMetadata,
		);

		const finalRagOptions = { ...rag_options, namespace: finalNamespace };
		const inserted = await embedding.insert(generated, finalRagOptions);

		// @ts-ignore
		if (inserted.status !== "success" && !inserted.documentDetails) {
			logger.error("Embedding insertion failed", inserted);
			throw new AssistantError("Embedding insertion failed");
		}

		return {
			status: "success",
			data: {
				id: uniqueId,
				metadata: { ...metadata, title },
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

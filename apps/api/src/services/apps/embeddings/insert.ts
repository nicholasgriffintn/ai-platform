import { generateId } from "~/utils/id";
import { Database } from "../../../lib/database";
import { Embedding } from "../../../lib/embedding";
import type { IRequest, RagOptions } from "../../../types";
import { chunkText } from "../../../utils/embeddings";
import { AssistantError, ErrorType } from "../../../utils/errors";
import { getLogger } from "../../../utils/logger";

const logger = getLogger({ prefix: "INSERT_EMBEDDING" });

// @ts-ignore
export interface IInsertEmbeddingRequest extends IRequest {
  request: {
    type: string;
    content: string;
    id: string;
    metadata: Record<string, any>;
    title: string;
    rag_options: RagOptions;
  };
}

export const insertEmbedding = async (
  req: IInsertEmbeddingRequest,
): Promise<any> => {
  try {
    const { request, env } = req;

    const { type, content, id, metadata, title, rag_options } = request;

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
    const newMetadata = { ...metadata, title };

    const database = Database.getInstance(env);

    if (type === "blog") {
      const blogExists = await database.getEmbeddingIdByType(id, "blog");

      if (!blogExists) {
        throw new AssistantError(
          "Blog does not exist. You can only insert blog embeddings for existing blogs.",
          ErrorType.NOT_FOUND,
        );
      }

      uniqueId = id;
    } else {
      uniqueId = id || `${Date.now()}-${generateId()}`;

      await database.insertEmbedding(
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

    const userSettings = await database.getUserSettings(req.user?.id);
    const embedding = Embedding.getInstance(env, req.user, userSettings);

    const finalNamespace = embedding.getNamespace({
      namespace: rag_options.namespace,
    });

    // Chunking: split document into smaller pieces if it exceeds maxChars
    const maxChars = rag_options.chunkSize || 2000;
    const chunks = chunkText(content, maxChars);
    let allGenerated: any[] = [];
    if (chunks.length > 1) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${id || uniqueId}-${i}`;
        const chunkMeta = { ...metadata, title, chunkIndex: i.toString() };

        await database.insertEmbedding(
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
    logger.error("Error inserting embedding", { error });
    throw new AssistantError("Error inserting embedding");
  }
};

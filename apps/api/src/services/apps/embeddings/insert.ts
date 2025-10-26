import { sanitiseInput } from "~/lib/chat/utils";
import { Database } from "~/lib/database";
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

    const {
      type,
      content: requestContent,
      id,
      metadata,
      title: requestTitle,
      rag_options = {},
    } = request;

    const content = sanitiseInput(requestContent);
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
    // Metadata travels from the original upload request all the way through to
    // the embedding provider. For file uploads the metadata object typically
    // contains the public asset URL plus additional descriptors supplied by the
    // upload service (see services/uploads). The current shape we rely on for
    // Bedrock ingestion looks like:
    // {
    //   title: string;                // Added below for all documents
    //   url?: string;                 // Public URL returned from handleFileUpload
    //   fileUrl?: string;             // Some clients explicitly alias the URL
    //   fileName?: string;            // Original filename supplied by the client
    //   mimeType?: string;            // MIME type reported during upload
    //   fileBase64?: string;          // Optional inline payload for direct ingest
    //   storageKey?: string;          // Optional R2 key when known client side
    //   chunkIndex?: string;          // Added when chunking in this service
    //   [additional attributes]: any; // Free-form attributes preserved verbatim
    // }
    // The Bedrock embedding provider inspects these fields to decide whether a
    // document should be sent as inline text (notes) or as a binary upload
    // (files).
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
    logger.error("Error inserting embedding", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorObject: error,
    });

    throw new AssistantError("Error inserting embedding");
  }
};

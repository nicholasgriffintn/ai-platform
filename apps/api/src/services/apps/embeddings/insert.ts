import { Database } from "../../../lib/database";
import { Embedding } from "../../../lib/embedding";
import type { IRequest, RagOptions } from "../../../types";
import { AssistantError, ErrorType } from "../../../utils/errors";

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
      uniqueId =
        id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

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

    const embedding = Embedding.getInstance(env);

    const generated = await embedding.generate(
      type,
      content,
      uniqueId,
      newMetadata,
    );
    const inserted = await embedding.insert(generated, rag_options);

    // @ts-ignore
    if (inserted.status !== "success" && !inserted.documentDetails) {
      console.error("Embedding insertion failed", inserted);
      throw new AssistantError("Embedding insertion failed");
    }

    return {
      status: "success",
      data: {
        id: uniqueId,
        metadata: newMetadata,
        title,
        content,
        type,
      },
    };
  } catch (error) {
    console.error("Error inserting embedding", error);
    throw new AssistantError("Error inserting embedding");
  }
};

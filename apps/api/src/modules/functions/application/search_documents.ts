import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { queryEmbeddings } from "~/modules/apps/application/embeddings/query";
import type { ApiToolDefinition } from "~/types/functions";

import { search_documents as search_documentsDescriptor } from "./definitions/search_documents";
import { rerankAuthorisedDocuments } from "./document-reranking";
import { resolveRequestProjectId } from "./request-context";

export const search_documents: ApiToolDefinition = {
  ...search_documentsDescriptor,
  execute: async (args, context) => {
    const request = context.request;

    if (resolveRequestProjectId(request)) {
      throw new AssistantError(
        "Project document retrieval is not available yet",
        ErrorType.CONFIGURATION_ERROR,
        501,
      );
    }

    const response = await queryEmbeddings({
      context: request.context,
      env: request.env,
      user: request.user,
      request: {
        query: String(args.query),
        type: args.type as string | undefined,
      },
    });
    const reranked = await rerankAuthorisedDocuments({
      env: request.env,
      user: request.user,
      completionId: context.completionId,
      conversationId: request.request?.completion_id,
      query: String(args.query),
      documents: response.data,
    });
    const documents = reranked.slice(0, (args.top_k as number | undefined) ?? 3);

    if (documents.length === 0) {
      return {
        status: "success",
        name: "search_documents",
        content: "No matching passages were found in the user's documents.",
        data: { renderer: "document_search", query: args.query, documents: [] },
      };
    }

    return {
      status: "success",
      name: "search_documents",
      content: JSON.stringify(documents, null, 2),
      data: { renderer: "document_search", query: args.query, documents },
    };
  },
};

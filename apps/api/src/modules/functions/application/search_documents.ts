import { queryEmbeddings } from "~/modules/apps/application/embeddings/query";
import type { ApiToolDefinition } from "~/types/functions";

import { queryConnectedDocuments } from "./connected-documents";
import { search_documents as search_documentsDescriptor } from "./definitions/search_documents";
import { rerankAuthorisedDocuments } from "./document-reranking";
import { resolveRequestProjectId } from "./request-context";

export const search_documents: ApiToolDefinition = {
  ...search_documentsDescriptor,
  execute: async (args, context) => {
    const request = context.request;

    const projectId = resolveRequestProjectId(request);
    const connected =
      !args.type || args.type === "repository"
        ? await queryConnectedDocuments(request, args.query, 10)
        : [];

    const response = projectId
      ? { data: [] }
      : await queryEmbeddings({
          context: request.context,
          env: request.env,
          user: request.user,
          request: {
            query: args.query,
            type: args.type,
          },
        });
    const reranked = await rerankAuthorisedDocuments({
      env: request.env,
      user: request.user,
      completionId: context.completionId,
      conversationId: request.request?.completion_id,
      query: args.query,
      documents: [...connected, ...response.data],
    });
    const documents = reranked.slice(0, args.top_k ?? 3);

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

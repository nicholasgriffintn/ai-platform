import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { queryEmbeddings } from "~/modules/apps/application/embeddings/query";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge-search";
import type { ApiToolDefinition } from "~/types/functions";

import { queryConnectedDocuments } from "./connected-documents";
import {
  search_documents as search_documentsDescriptor,
  searchDocumentsInputSchema,
} from "./definitions/search_documents";
import { rerankAuthorisedDocuments, type RerankableDocument } from "./document-reranking";
import { resolveRequestProjectId } from "./request-context";

export const search_documents: ApiToolDefinition = {
  ...search_documentsDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const input = searchDocumentsInputSchema.parse(args);
    const projectId = resolveRequestProjectId(request);
    const [response, connected] = await Promise.all([
      projectId
        ? searchProjectKnowledge(
            resolveServiceContext({
              context: request.context,
              env: request.env,
              user: request.user,
            }),
            { ...input, projectId },
          )
        : queryEmbeddings({
            context: request.context,
            env: request.env,
            user: request.user,
            request: input,
          }),
      queryConnectedDocuments(request, input.query, input.top_k ?? 3),
    ]);
    const reranked = await rerankAuthorisedDocuments<RerankableDocument>({
      env: request.env,
      user: request.user,
      completionId: context.completionId,
      conversationId: request.request?.completion_id,
      query: input.query,
      documents: [...connected, ...response.data],
    });
    const documents = reranked.slice(0, input.top_k ?? 3);

    if (documents.length === 0) {
      return {
        status: "success",
        name: "search_documents",
        content: "No matching passages were found in the current document scope.",
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

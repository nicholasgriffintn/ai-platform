import { queryEmbeddings } from "~/services/apps/embeddings/query";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { ApiToolDefinition } from "../../types/functions";
import { search_documents as search_documentsDescriptor } from "./definitions/search_documents";
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
    const documents = response.data.slice(0, (args.top_k as number | undefined) ?? 3);

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

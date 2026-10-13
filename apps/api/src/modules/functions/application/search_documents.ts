import { projectKnowledgeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge-search";
import type { ApiToolDefinition } from "~/types/functions";

import { search_documents as search_documentsDescriptor } from "./definitions/search_documents";
import { resolveRequestProjectId } from "./request-context";

export const search_documents: ApiToolDefinition = {
  ...search_documentsDescriptor,
  execute: async (args, context) => {
    const request = context.request;

    const response = await searchProjectKnowledge(
      resolveServiceContext(request),
      projectKnowledgeSearchQuerySchema.parse({
        query: args.query,
        type: args.type,
        top_k: args.top_k ?? 3,
        projectId: resolveRequestProjectId(request) ?? undefined,
      }),
    );
    const documents = response.data;

    if (documents.length === 0) {
      return {
        status: "success",
        name: "search_documents",
        content: "No matching passages were found in the current knowledge sources.",
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

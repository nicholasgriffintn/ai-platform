import { projectKnowledgeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge/search";
import { formatSourceCitation } from "~/modules/sources/domain/citation";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { ApiToolDefinition } from "~/types/functions";

import { search_documents as search_documentsDescriptor } from "./definitions/search_documents";

export const search_documents: ApiToolDefinition = {
  ...search_documentsDescriptor,
  execute: async (args, context) => {
    const request = context.request;
    const notebook = request.notebook;

    const response = await searchProjectKnowledge(
      resolveServiceContext(request),
      projectKnowledgeSearchQuerySchema.parse({
        query: args.query,
        type: args.type,
        top_k: args.top_k ?? (notebook ? 6 : 3),
        projectId: notebook
          ? (notebook.projectId ?? undefined)
          : (resolveRequestProjectId(request) ?? undefined),
        sourceIds: notebook?.sourceIds,
      }),
    );
    const documents = notebook
      ? response.data.map((document) => ({
          ...document,
          cite: formatSourceCitation({ id: document.sourceId, title: document.title }),
        }))
      : response.data;

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

import { projectKnowledgeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge-search";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { ApiToolDefinition } from "~/types/functions";

import { get_note as get_noteDescriptor } from "./definitions/get_note";

export const get_note: ApiToolDefinition = {
  ...get_noteDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const response = await searchProjectKnowledge(
      resolveServiceContext(request),
      projectKnowledgeSearchQuerySchema.parse({
        query: args.query,
        type: "text",
        projectId: resolveRequestProjectId(request) ?? undefined,
      }),
    );

    return {
      status: "success",
      name: "get_note",
      content: "Notes retrieved from the current knowledge sources",
      data: { renderer: "document_search", query: args.query, documents: response.data },
    };
  },
};

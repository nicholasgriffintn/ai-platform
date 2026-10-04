import { knowledgeSearchSchema } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchKnowledge } from "~/modules/sources/application/knowledge-search";
import type { ApiToolDefinition } from "~/types/functions";

import { get_note as get_noteDescriptor } from "./definitions/get_note";
import { resolveRequestProjectId } from "./request-context";

export const get_note: ApiToolDefinition = {
  ...get_noteDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const response = await searchKnowledge(
      resolveServiceContext(request),
      knowledgeSearchSchema.parse({
        query: args.query,
        type: "text",
        projectId: resolveRequestProjectId(request) ?? undefined,
      }),
    );

    return {
      status: "success",
      name: "get_note",
      content: "Notes retrieved from the current knowledge sources",
      data: { renderer: "document_search", query: args.query, documents: response.documents },
    };
  },
};

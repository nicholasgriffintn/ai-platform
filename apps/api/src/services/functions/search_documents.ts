import z from "zod/v4";

import {
  getEmbeddingProvider,
  searchDocuments as searchEmbeddedDocuments,
} from "~/lib/providers/capabilities/embedding/helpers";

import type { ApiToolDefinition } from "../../types/functions";

export const search_documents: ApiToolDefinition = {
  name: "search_documents",
  description:
    "Search the user's own uploaded documents and saved content for passages relevant to a query. Returns the passages, not an answer; ground what you say in them and cite them by title. Use when the answer depends on the user's material rather than on general knowledge.",
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe("What to look for, phrased as the user would describe it rather than as keywords."),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("How many passages to return. Defaults to three."),
    type: z
      .string()
      .optional()
      .describe("Restrict the search to one content type, when the user named one."),
  }),
  execute: async (args, context) => {
    const request = context.request;
    const provider = getEmbeddingProvider(request.env, request.user, undefined);
    const documents = await searchEmbeddedDocuments({
      provider,
      query: String(args.query),
      options: {
        top_k: args.top_k as number | undefined,
        type: args.type as string | undefined,
        ...request.rag_options,
      },
      env: request.env,
      user: request.user,
    });

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

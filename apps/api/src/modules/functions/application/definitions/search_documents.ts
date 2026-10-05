import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const search_documents: FunctionToolDescriptor = {
  name: "search_documents",
  description:
    "Search accessible synced repository knowledge and the user's own uploaded documents for relevant passages. Project conversations search their project knowledge. Repository search matches a phrase: use concise keywords. Ground answers in returned passages and cite their source URLs when available.",
  type: "premium",
  permissions: ["read"],
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("A short search phrase. Use concise keywords for synced repository documents."),
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
      .describe("Restrict the search to one content type. Use repository for synced documents."),
  }),
};

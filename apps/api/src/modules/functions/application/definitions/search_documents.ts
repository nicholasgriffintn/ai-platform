import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const search_documents: FunctionToolDescriptor = {
  name: "search_documents",
  description:
    "Search the current personal or project knowledge sources using exact terms and semantic meaning. Returns cited passages; ground the answer in them and cite their titles and source URLs. Use when the answer depends on uploaded documents, saved notes or synced knowledge.",
  type: "premium",
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
};

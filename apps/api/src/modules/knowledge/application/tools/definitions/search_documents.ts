import { projectKnowledgeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const searchDocumentsInputSchema = projectKnowledgeSearchQuerySchema
  .omit({ projectId: true, sourceIds: true, resourceTypes: true, providers: true, syncIds: true })
  .extend({
    top_k: z.number().int().min(1).max(10).optional(),
    kinds: z
      .array(z.string().trim().min(1).max(80))
      .max(12)
      .optional()
      .describe(
        "Only these kinds: source kinds such as file, text, url, connector, or made items such as document, deck, sheet.",
      ),
    collectionIds: z
      .array(z.string().min(1))
      .max(50)
      .optional()
      .describe("Only documents in these notebooks, folders, topics or entities."),
    includeExternal: z
      .boolean()
      .optional()
      .describe("Also search the knowledge bases connected to this scope, such as Bedrock."),
  });

export const search_documents: FunctionToolDescriptor = {
  name: "search_documents",
  description:
    "Search the knowledge in the current personal or project scope: sources, synced documents, followed feeds and finished made items such as documents, decks and sheets. Narrow by kind, origin, collection or date when the question calls for it, and set includeExternal to also search connected knowledge bases. Project searches never include personal material. Ground answers in the returned passages and cite their titles and revisions.",
  type: "premium",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: searchDocumentsInputSchema,
};

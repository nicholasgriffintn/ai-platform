import { projectKnowledgeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const searchDocumentsInputSchema = projectKnowledgeSearchQuerySchema
  .omit({ projectId: true })
  .extend({ top_k: z.number().int().min(1).max(10).optional() });

export const search_documents: FunctionToolDescriptor = {
  name: "search_documents",
  description:
    "Search documents, saved content and authorised repository knowledge in the current personal or project scope. Project searches include available project Sources and never search personal material. Ground answers in the returned passages and cite their source titles and revisions.",
  type: "premium",
  permissions: ["read"],
  inputSchema: searchDocumentsInputSchema,
};

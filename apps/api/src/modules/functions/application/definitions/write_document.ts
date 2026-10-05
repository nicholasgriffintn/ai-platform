import { DOCUMENT_WRITE_TOOL_NAME, writeDocumentInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const write_document: FunctionToolDescriptor = {
  name: DOCUMENT_WRITE_TOOL_NAME,
  description:
    "Write a durable document in Files: a brief, report, plan or note. When revising an existing document, read it with get_document first, then pass its outputId and expectedRevision. A stale revision is rejected; reread before proposing another edit.",
  type: "normal",
  permissions: ["write"],
  inputSchema: writeDocumentInputSchema,
  intentEvidence: (input) => ({
    operation: input.outputId ? "revise_document" : "create_document",
    scope: input.projectId ? "project" : "personal",
  }),
};

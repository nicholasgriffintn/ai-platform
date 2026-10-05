import { DOCUMENT_READ_TOOL_NAME, readDocumentInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const get_document: FunctionToolDescriptor = {
  name: DOCUMENT_READ_TOOL_NAME,
  description:
    "Read a saved document, including its current revision. Use it before revising an existing document. Pass commentId to retrieve the exact discussion request attached to a project task.",
  type: "normal",
  permissions: ["read"],
  inputSchema: readDocumentInputSchema,
};

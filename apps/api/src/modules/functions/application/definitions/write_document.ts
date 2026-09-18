import { DOCUMENT_WRITE_TOOL_NAME, writeDocumentInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const write_document: FunctionToolDescriptor = {
  name: DOCUMENT_WRITE_TOOL_NAME,
  description:
    "Write a document the user keeps: a brief, a report, a plan, a note to send on. It is saved as a durable result they can find in Files, revise and export. Use it when the answer is a document rather than a reply, and pass outputId to revise one you already wrote instead of writing a second copy.",
  type: "normal",
  permissions: ["write"],
  inputSchema: writeDocumentInputSchema,
};

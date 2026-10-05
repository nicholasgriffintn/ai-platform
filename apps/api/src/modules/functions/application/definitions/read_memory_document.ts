import { readMemoryDocumentSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const read_memory_document: FunctionToolDescriptor = {
  name: "read_memory_document",
  description:
    "Read a bounded page of a memory document in this run's memory scope. Use the documentId and revision from the memory index or search_memories results, then nextOffset for further pages. Bound teammate and delegated runs can only read explicitly granted documents. If the revision changes, refresh the index or search before combining pages.",
  inputSchema: readMemoryDocumentSchema,
  type: "normal",
  permissions: ["read"],
};

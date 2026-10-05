import {
  NATIVE_RECORD_READ_TOOL_NAME,
  NATIVE_RECORD_WRITE_TOOL_NAME,
  readNativeRecordsInputSchema,
  writeNativeRecordsInputSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const read_records: FunctionToolDescriptor = {
  name: NATIVE_RECORD_READ_TOOL_NAME,
  description:
    "Read native record tables in Files. Discover tables, inspect their typed columns and revision, query authorised rows, or resume their change feed. Use table and row revisions when proposing edits. Record views can reuse these tables in documents and Sites.",
  type: "normal",
  permissions: ["read"],
  inputSchema: readNativeRecordsInputSchema,
};

export const write_records: FunctionToolDescriptor = {
  name: NATIVE_RECORD_WRITE_TOOL_NAME,
  description:
    "Create or change native record tables and rows in Files. Read the table first with read_records. Capture tableRevision for row writes and expectedRevision for existing rows or tables. Use one requestId for retries of a new record. Conflicts require a reread. Column changes must keep existing rows valid.",
  type: "normal",
  permissions: ["write"],
  inputSchema: writeNativeRecordsInputSchema,
  intentEvidence: (input) => ({
    operation: input.action,
    tableId: input.tableId ?? null,
    recordId: input.recordId ?? null,
  }),
};

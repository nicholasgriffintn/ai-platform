import { excerptMemoryDocument, memoryDocumentTypeSchema } from "@ngriffin_uk/polychat-schemas";
import { readOptionalString } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import type { MemoryDocumentDetails } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";

export function readMemoryDocumentDetails(
  row: Pick<MemoryDocumentRow, "metadata">,
): MemoryDocumentDetails {
  const metadata = parseJsonRecord(row.metadata);
  const type = memoryDocumentTypeSchema.safeParse(metadata.type);

  return {
    description: readOptionalString(metadata.description) ?? "",
    type: type.success ? type.data : null,
  };
}

export function describeMemoryDocument(
  row: Pick<MemoryDocumentRow, "metadata" | "content">,
): string {
  return readMemoryDocumentDetails(row).description || excerptMemoryDocument(row.content);
}

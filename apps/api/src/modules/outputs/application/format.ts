import type { Output } from "@ngriffin_uk/polychat-schemas";

import type { OutputRecord } from "../infrastructure/OutputRepository";
import { parseOutputContent } from "./deletion";
import { parseOutputProvenance } from "./provenance";

export function formatOutput(record: OutputRecord): Output {
  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    conversationId: record.conversation_id,
    parentOutputId: record.parent_output_id,
    capabilityId: record.capability_id,
    groupId: record.group_id,
    kind: record.kind,
    title: record.title,
    status: record.status,
    sensitivity: record.sensitivity,
    content: parseOutputContent(record.content),
    file:
      record.storage_key && record.mime_type
        ? {
            key: record.storage_key,
            mimeType: record.mime_type,
            filename: record.filename,
            byteSize: record.byte_size,
          }
        : null,
    revision: record.revision,
    provenance: parseOutputProvenance(record.provenance_json, record.created_at),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

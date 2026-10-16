import type { WorkspaceAuditRecord } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { WorkspaceAuditRecordRow } from "~/modules/audit/infrastructure/AuditRepository";

export function formatAuditRecord(record: WorkspaceAuditRecordRow): WorkspaceAuditRecord {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    actorUserId: record.actor_user_id,
    action: record.action,
    targetType: record.target_type,
    targetId: record.target_id,
    metadata: safeParseJson<Record<string, unknown>>(record.metadata) ?? {},
    createdAt: record.created_at,
  };
}

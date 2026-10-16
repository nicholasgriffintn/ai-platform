import { toListPage, type WorkspaceAuditRecord } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { WorkspaceAuditRecordRow } from "~/modules/audit/infrastructure/AuditRepository";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

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

export async function listWorkspaceAudit(
  context: ServiceContext,
  workspaceId: string,
  options: { limit: number; after?: string },
) {
  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);

  const rows = await context.repositories.get(AuditRepository).listRecords(workspaceId, {
    ...options,
    limit: options.limit + 1,
  });

  return toListPage(rows.map(formatAuditRecord), options.limit, (record) => record.id);
}

export async function recordProjectAudit(
  context: ServiceContext,
  projectId: string,
  input: Omit<Parameters<AuditRepository["createRecord"]>[0], "workspaceId">,
) {
  const project = await context.repositories.get(WorkspaceRepository).getProject(projectId);

  if (!project) {
    return;
  }

  await context.repositories
    .get(AuditRepository)
    .createRecord({ ...input, workspaceId: project.workspace_id });
}

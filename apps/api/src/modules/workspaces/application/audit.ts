import { toListPage } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatAuditRecord } from "~/modules/audit/application";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

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

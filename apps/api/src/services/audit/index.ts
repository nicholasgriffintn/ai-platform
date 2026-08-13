import type { WorkspaceAuditRecord } from "@ngriffin_uk/polychat-schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { WorkspaceAuditRecordRow } from "~/repositories/AuditRepository";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { safeParseJson } from "~/utils/json";

function formatAuditRecord(record: WorkspaceAuditRecordRow): WorkspaceAuditRecord {
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
	return {
		records: (await context.repositories.audit.listRecords(workspaceId, options)).map(
			formatAuditRecord,
		),
	};
}

export async function recordProjectAudit(
	context: ServiceContext,
	projectId: string,
	input: Omit<
		Parameters<ServiceContext["repositories"]["audit"]["createRecord"]>[0],
		"workspaceId"
	>,
) {
	const project = await context.repositories.workspaces.getProject(projectId);
	if (!project) return;
	await context.repositories.audit.createRecord({ ...input, workspaceId: project.workspace_id });
}

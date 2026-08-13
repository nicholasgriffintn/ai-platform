import type {
	CreateTemplateInput,
	ProjectDetail,
	Template,
	WorkspaceAuditRecord,
	WorkspaceDetail,
	WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { fetchApiOrThrow } from "./fetch-wrapper";

async function request<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
	const response = await fetchApiOrThrow(path, {
		method: init.method ?? "GET",
		headers: await apiService.getHeaders(),
		body: init.body,
	});
	return returnFetchedData<T>(response);
}

export async function listWorkspaceAudit(workspaceId: string): Promise<WorkspaceAuditRecord[]> {
	return (await request<{ records: WorkspaceAuditRecord[] }>(`/workspaces/${workspaceId}/audit`))
		.records;
}

export async function listWorkspaceTemplates(workspaceId: string): Promise<Template[]> {
	return (
		await request<{ templates: Template[] }>(
			`/templates?workspaceId=${encodeURIComponent(workspaceId)}`,
		)
	).templates;
}

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
	return request("/templates", { method: "POST", body: input });
}

export async function deleteTemplate(templateId: string): Promise<void> {
	await request(`/templates/${encodeURIComponent(templateId)}`, { method: "DELETE" });
}

export async function instantiateTemplate(
	templateId: string,
	workspaceId: string,
): Promise<ProjectDetail> {
	return request(`/templates/${encodeURIComponent(templateId)}/instantiate`, {
		method: "POST",
		body: { workspaceId },
	});
}

export async function updateWorkspaceMember(
	workspaceId: string,
	userId: number,
	role: Exclude<WorkspaceRole, "owner">,
): Promise<WorkspaceDetail> {
	return request(`/workspaces/${workspaceId}/members/${userId}`, {
		method: "PUT",
		body: { role },
	});
}

export async function removeWorkspaceMember(
	workspaceId: string,
	userId: number,
): Promise<WorkspaceDetail> {
	return request(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
	await request(`/workspaces/${workspaceId}/leave`, { method: "POST" });
}

export async function transferWorkspaceOwnership(
	workspaceId: string,
	newOwnerUserId: number,
): Promise<WorkspaceDetail> {
	return request(`/workspaces/${workspaceId}/transfer-ownership`, {
		method: "POST",
		body: { newOwnerUserId },
	});
}

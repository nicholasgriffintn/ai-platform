import type {
  CreateTemplateInput,
  ListPage,
  ProjectDetail,
  ProjectStarterSummary,
  Template,
  WorkspaceAuditRecord,
  WorkspaceDetail,
  WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { resource } from "./resource.js";

async function request<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const response = await fetchApiOrThrow(path, {
    method: init.method ?? "GET",
    headers: await apiService.getHeaders(),
    body: init.body,
  });

  return returnFetchedData<T>(response);
}

export function listWorkspaceAudit(workspaceId: string): Promise<WorkspaceAuditRecord[]> {
  return resource<WorkspaceAuditRecord>(
    `/workspaces/${encodeURIComponent(workspaceId)}/audit`,
  ).listAll();
}

export async function listWorkspaceTemplates(workspaceId: string): Promise<Template[]> {
  return (
    await request<ListPage<Template>>(`/templates?workspace_id=${encodeURIComponent(workspaceId)}`)
  ).data;
}

export async function listTeamTemplates(): Promise<Template[]> {
  return (await request<ListPage<Template>>("/templates?kind=team")).data;
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
  return request("/projects", {
    method: "POST",
    body: { workspace_id: workspaceId, template_id: templateId },
  });
}

export async function listProjectStarters(): Promise<ProjectStarterSummary[]> {
  return (await request<ListPage<ProjectStarterSummary>>("/templates/starters")).data;
}

export async function instantiateProjectStarter(
  starterSlug: string,
  workspaceId: string,
): Promise<ProjectDetail> {
  return request("/projects", {
    method: "POST",
    body: { workspace_id: workspaceId, starter_id: starterSlug },
  });
}

export async function updateWorkspaceMember(
  workspaceId: string,
  userId: number,
  role: Exclude<WorkspaceRole, "owner">,
): Promise<WorkspaceDetail> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/members/${userId}`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: number,
): Promise<WorkspaceDetail> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
  await request(`/workspaces/${encodeURIComponent(workspaceId)}/leave`, { method: "POST" });
}

export async function transferWorkspaceOwnership(
  workspaceId: string,
  newOwnerUserId: number,
): Promise<WorkspaceDetail> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/transfer_ownership`, {
    method: "POST",
    body: { newOwnerUserId },
  });
}

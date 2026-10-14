import type {
  AddProjectCapabilityInput,
  CreateProjectInput,
  CreateWorkspaceInput,
  CreateWorkspaceInvitationInput,
  ProjectDetail,
  SandboxEnvironmentCacheAction,
  SandboxEnvironmentCacheActionResponse,
  UpdateProjectInput,
  UpdateWorkspaceInput,
  WorkspaceDetail,
  WorkspaceInvitationDelivery,
  WorkspaceSummary,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource } from "./resource.js";

const workspaces = resource<WorkspaceSummary>("/workspaces");
const projects = resource<ProjectDetail>("/projects");

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return workspaces.listAll();
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
  return requestJson<WorkspaceDetail>(
    `${workspaces.path}/${encodeURIComponent(workspaceId)}`,
    "GET",
  );
}

export function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDetail> {
  return requestJson<WorkspaceDetail>(workspaces.path, "POST", input);
}

export function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceDetail> {
  return requestJson<WorkspaceDetail>(
    `${workspaces.path}/${encodeURIComponent(workspaceId)}`,
    "PATCH",
    input,
  );
}

export function deleteWorkspace(workspaceId: string): Promise<void> {
  return workspaces.delete(workspaceId);
}

export function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectDetail> {
  return projects.create({ ...input, workspace_id: workspaceId });
}

export function getProject(projectId: string): Promise<ProjectDetail> {
  return projects.get(projectId);
}

export function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDetail> {
  return projects.update(projectId, input);
}

export function archiveProject(projectId: string): Promise<void> {
  return projects.delete(projectId);
}

export function updateProjectEnvironmentCache(
  projectId: string,
  input: SandboxEnvironmentCacheAction,
): Promise<SandboxEnvironmentCacheActionResponse> {
  return requestJson<SandboxEnvironmentCacheActionResponse>(
    projects.singleton(projectId, "environment_cache").path,
    input.action === "rebuild" ? "POST" : "DELETE",
  );
}

export function inviteWorkspaceMember(
  workspaceId: string,
  input: CreateWorkspaceInvitationInput,
): Promise<WorkspaceInvitationDelivery> {
  return requestJson<WorkspaceInvitationDelivery>(
    workspaces.sub(workspaceId, "invitations").path,
    "POST",
    input,
  );
}

export function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<void> {
  return workspaces.sub(workspaceId, "invitations").delete(invitationId);
}

export function acceptWorkspaceInvitation(token: string): Promise<WorkspaceDetail> {
  return requestJson<WorkspaceDetail>(`${workspaces.path}/invitations/accept`, "POST", { token });
}

export function addProjectCapability(
  projectId: string,
  input: AddProjectCapabilityInput,
): Promise<ProjectDetail> {
  return requestJson<ProjectDetail>(projects.sub(projectId, "capabilities").path, "POST", input);
}

export function removeProjectCapability(
  projectId: string,
  capabilityId: string,
): Promise<ProjectDetail> {
  return requestJson<ProjectDetail>(
    `${projects.sub(projectId, "capabilities").path}/${encodeURIComponent(capabilityId)}`,
    "DELETE",
  );
}

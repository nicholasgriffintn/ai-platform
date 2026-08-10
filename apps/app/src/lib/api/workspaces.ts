import type {
	AddProjectCapabilityInput,
	CreateProjectInput,
	CreateWorkspaceInput,
	CreateWorkspaceInvitationInput,
	ProjectDetail,
	UpdateProjectInput,
	UpdateWorkspaceInput,
	WorkspaceDetail,
	WorkspaceInvitationDelivery,
	WorkspaceSummary,
} from "@assistant/schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";

async function authHeaders() {
	return apiService.getHeaders();
}

export async function listWorkspaces(): Promise<{ workspaces: WorkspaceSummary[] }> {
	const response = await fetchApiOrThrow("/workspaces", {
		method: "GET",
		headers: await authHeaders(),
	});
	return returnFetchedData(response);
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
	const response = await fetchApiOrThrow(`/workspaces/${workspaceId}`, {
		method: "GET",
		headers: await authHeaders(),
	});
	return returnFetchedData(response);
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDetail> {
	const response = await fetchApiOrThrow("/workspaces", {
		method: "POST",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function updateWorkspace(
	workspaceId: string,
	input: UpdateWorkspaceInput,
): Promise<WorkspaceDetail> {
	const response = await fetchApiOrThrow(`/workspaces/${workspaceId}`, {
		method: "PUT",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function createProject(
	workspaceId: string,
	input: CreateProjectInput,
): Promise<ProjectDetail> {
	const response = await fetchApiOrThrow(`/workspaces/${workspaceId}/projects`, {
		method: "POST",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
	const response = await fetchApiOrThrow(`/projects/${projectId}`, {
		method: "GET",
		headers: await authHeaders(),
	});
	return returnFetchedData(response);
}

export async function updateProject(
	projectId: string,
	input: UpdateProjectInput,
): Promise<ProjectDetail> {
	const response = await fetchApiOrThrow(`/projects/${projectId}`, {
		method: "PUT",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function inviteWorkspaceMember(
	workspaceId: string,
	input: CreateWorkspaceInvitationInput,
): Promise<WorkspaceInvitationDelivery> {
	const response = await fetchApiOrThrow(`/workspaces/${workspaceId}/invitations`, {
		method: "POST",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function acceptWorkspaceInvitation(token: string): Promise<WorkspaceDetail> {
	const response = await fetchApiOrThrow("/workspace-invitations/accept", {
		method: "POST",
		headers: await authHeaders(),
		body: { token },
	});
	return returnFetchedData(response);
}

export async function addProjectCapability(
	projectId: string,
	input: AddProjectCapabilityInput,
): Promise<ProjectDetail> {
	const response = await fetchApiOrThrow(`/projects/${projectId}/capabilities`, {
		method: "POST",
		headers: await authHeaders(),
		body: input,
	});
	return returnFetchedData(response);
}

export async function removeProjectCapability(
	projectId: string,
	capabilityId: string,
): Promise<ProjectDetail> {
	const response = await fetchApiOrThrow(`/projects/${projectId}/capabilities/${capabilityId}`, {
		method: "DELETE",
		headers: await authHeaders(),
	});
	return returnFetchedData(response);
}

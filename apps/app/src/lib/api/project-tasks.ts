import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  CreateProjectTaskInput,
  ProjectFlow,
  ProjectTask,
  ProjectTaskAttentionResponse,
  ProjectTaskListResponse,
  UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

async function authHeaders() {
  return apiService.getHeaders();
}

export async function listProjectTasks(projectId: string): Promise<ProjectTaskListResponse> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function createProjectTask(
  projectId: string,
  input: CreateProjectTaskInput,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks`, {
    method: "POST",
    headers: await authHeaders(),
    body: input,
  });

  return returnFetchedData(response);
}

export async function updateProjectTask(
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: input,
  });

  return returnFetchedData(response);
}

export async function startProjectTask(
  projectId: string,
  taskId: string,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}/start`, {
    method: "POST",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function acceptProjectTask(
  projectId: string,
  taskId: string,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}/accept`, {
    method: "POST",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function deleteProjectTask(projectId: string, taskId: string): Promise<void> {
  await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function setProjectFlow(
  projectId: string,
  flow: ProjectFlow | null,
): Promise<{ flow: ProjectFlow | null }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/flow`, {
    method: "PUT",
    headers: await authHeaders(),
    body: { flow },
  });

  return returnFetchedData(response);
}

export async function listTaskAttention(): Promise<ProjectTaskAttentionResponse> {
  const response = await fetchApiOrThrow("/workspaces/attention", {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

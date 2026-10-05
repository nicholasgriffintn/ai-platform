import type {
  AnswerUserQuestionsInput,
  CreateProjectTaskInput,
  ProjectFlow,
  ProjectFlowResponse,
  ProjectFlowHistory,
  ResolveProjectFlowWaitInput,
  ProjectTask,
  ProjectTaskDetailResponse,
  ProjectTaskListResponse,
  ResolveProjectTaskToolApprovalInput,
  UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

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

export async function getProjectTask(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDetailResponse> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}`, {
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

export async function resolveProjectFlowWait(
  projectId: string,
  taskId: string,
  waitId: string,
  input: ResolveProjectFlowWaitInput,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(
    `/projects/${projectId}/tasks/${taskId}/waits/${waitId}/response`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: input,
    },
  );

  return returnFetchedData(response);
}

export async function getProjectFlowHistory(
  projectId: string,
  taskId: string,
  after = 0,
): Promise<ProjectFlowHistory> {
  const response = await fetchApiOrThrow(
    `/projects/${projectId}/tasks/${taskId}/flow-history?after=${after}`,
    {
      method: "GET",
      headers: await authHeaders(),
    },
  );

  return returnFetchedData(response);
}

export async function answerProjectTaskQuestions(
  projectId: string,
  taskId: string,
  input: AnswerUserQuestionsInput,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}/answers`, {
    method: "POST",
    headers: await authHeaders(),
    body: input,
  });

  return returnFetchedData(response);
}

export async function resolveProjectTaskToolApproval(
  projectId: string,
  taskId: string,
  input: ResolveProjectTaskToolApprovalInput,
): Promise<{ task: ProjectTask }> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}/tool-approval`, {
    method: "POST",
    headers: await authHeaders(),
    body: input,
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
): Promise<ProjectFlowResponse> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/flow`, {
    method: "PUT",
    headers: await authHeaders(),
    body: { flow },
  });

  return returnFetchedData(response);
}

export async function getProjectFlow(projectId: string): Promise<ProjectFlowResponse> {
  const response = await fetchApiOrThrow(`/projects/${projectId}/flow`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

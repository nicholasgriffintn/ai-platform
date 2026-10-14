import type {
  AnswerUserQuestionsInput,
  CreateProjectTaskInput,
  ProjectFlow,
  ProjectTask,
  ProjectTaskDetailResponse,
  ProjectTaskListResponse,
  ResolveProjectTaskToolApprovalInput,
  UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { requestJson } from "./resource.js";

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

async function sendTaskInteraction(
  projectId: string,
  taskId: string,
  interaction: (detail: ProjectTaskDetailResponse) => { toolName: string; response: object },
): Promise<{ task: ProjectTask }> {
  const detail = await getProjectTask(projectId, taskId);
  const responseId = detail.task.runId;

  if (!responseId) {
    throw new Error("This task has no response waiting for input");
  }

  const { toolName, response } = interaction(detail);

  await requestJson<unknown>(`/responses/${encodeURIComponent(responseId)}/input`, "POST", {
    input: [{ type: "interaction_response", tool_name: toolName, response }],
  });

  return { task: (await getProjectTask(projectId, taskId)).task };
}

export function answerProjectTaskQuestions(
  projectId: string,
  taskId: string,
  input: AnswerUserQuestionsInput,
): Promise<{ task: ProjectTask }> {
  return sendTaskInteraction(projectId, taskId, () => ({ toolName: "ask_user", response: input }));
}

export function resolveProjectTaskToolApproval(
  projectId: string,
  taskId: string,
  input: ResolveProjectTaskToolApprovalInput,
): Promise<{ task: ProjectTask }> {
  return sendTaskInteraction(projectId, taskId, (detail) => ({
    toolName: detail.pendingApproval?.toolName ?? "tool_approval",
    response: input,
  }));
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
    method: "PATCH",
    headers: await authHeaders(),
    body: { flow },
  });

  return returnFetchedData(response);
}

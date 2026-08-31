import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  CreateLeanProofProjectTaskInput,
  LeanProofProjectTaskDetailResponse,
  LeanProofProjectTaskListResponse,
  ProjectTask,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

async function authHeaders() {
  return apiService.getHeaders();
}

export async function createLeanProof(
  projectId: string,
  input: CreateLeanProofProjectTaskInput,
  idempotencyKey: string,
): Promise<{ task: ProjectTask }> {
  const headers = await authHeaders();
  const response = await fetchApiOrThrow(`/projects/${encodeURIComponent(projectId)}/lean-proofs`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": idempotencyKey },
    body: input,
  });

  return returnFetchedData(response);
}

export async function listLeanProofs(projectId: string): Promise<LeanProofProjectTaskListResponse> {
  const response = await fetchApiOrThrow(`/projects/${encodeURIComponent(projectId)}/lean-proofs`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function getLeanProof(
  projectId: string,
  taskId: string,
): Promise<LeanProofProjectTaskDetailResponse> {
  const response = await fetchApiOrThrow(
    `/projects/${encodeURIComponent(projectId)}/lean-proofs/${encodeURIComponent(taskId)}`,
    { method: "GET", headers: await authHeaders() },
  );

  return returnFetchedData(response);
}

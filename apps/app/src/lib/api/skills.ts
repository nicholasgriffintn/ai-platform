import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AuthoredSkillDocument,
  AuthoredSkillDraftInput,
  AuthoredSkillEvaluationCase,
  AuthoredSkillEvaluationCaseInput,
  AuthoredSkillEvaluationResult,
  AuthoredSkillEvaluationRunInput,
  AuthoredSkillHistoryResponse,
  AuthoredSkillPromotionInput,
  AuthoredSkillRollbackInput,
  AuthoredSkillVersionedDocument,
  SkillAvailability,
  SkillAvailabilityResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
}

function skillDocumentPath(skillId: string, projectId?: string): string {
  const encodedSkillId = encodeURIComponent(skillId);

  return projectId
    ? `/projects/${encodeURIComponent(projectId)}/skills/${encodedSkillId}`
    : `/skills/documents/${encodedSkillId}`;
}

async function skillRequest<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  errorMessage: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchApi(path, {
    method,
    headers: await readHeaders(),
    ...(body === undefined ? {} : { body }),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, errorMessage);
  }

  return returnFetchedData<T>(response);
}

export async function fetchPersonalSkills(): Promise<SkillAvailabilityResponse> {
  const response = await fetchApi("/skills", {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load skills");
  }

  return returnFetchedData<SkillAvailabilityResponse>(response);
}

export async function setPersonalSkillEnabled(
  skillId: string,
  enabled: boolean,
): Promise<SkillAvailability> {
  const response = await fetchApi(`/skills/${encodeURIComponent(skillId)}/enabled`, {
    method: "PUT",
    headers: await readHeaders(),
    body: { enabled },
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to update skill");
  }

  return returnFetchedData<SkillAvailability>(response);
}

export async function createSkill(
  content: string,
  projectId?: string,
): Promise<AuthoredSkillDocument> {
  const path = projectId
    ? `/projects/${encodeURIComponent(projectId)}/skills`
    : "/skills/documents";
  const response = await fetchApi(path, {
    method: "POST",
    headers: await readHeaders(),
    body: { content },
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to add skill");
  }

  return returnFetchedData<AuthoredSkillDocument>(response);
}

export async function deleteSkill(skillId: string, projectId?: string): Promise<void> {
  const path = skillDocumentPath(skillId, projectId);
  const response = await fetchApi(path, {
    method: "DELETE",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to delete skill");
  }
}

export function fetchSkillHistory(
  skillId: string,
  projectId?: string,
): Promise<AuthoredSkillHistoryResponse> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/history`,
    "GET",
    "Failed to load skill history",
  );
}

export function fetchSkillRevision(
  skillId: string,
  revisionId: string,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/revisions/${encodeURIComponent(revisionId)}`,
    "GET",
    "Failed to load skill revision",
  );
}

export function saveSkillDraft(
  skillId: string,
  input: AuthoredSkillDraftInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/draft`,
    "PUT",
    "Failed to save skill draft",
    input,
  );
}

export function promoteSkillDraft(
  skillId: string,
  input: AuthoredSkillPromotionInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/promote`,
    "POST",
    "Failed to promote skill draft",
    input,
  );
}

export function rollbackSkill(
  skillId: string,
  input: AuthoredSkillRollbackInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/rollback`,
    "POST",
    "Failed to roll back skill",
    input,
  );
}

export function fetchSkillEvaluationCases(
  skillId: string,
  projectId?: string,
): Promise<{ cases: AuthoredSkillEvaluationCase[] }> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/evaluation-cases`,
    "GET",
    "Failed to load evaluation cases",
  );
}

export function createSkillEvaluationCase(
  skillId: string,
  input: AuthoredSkillEvaluationCaseInput,
  projectId?: string,
): Promise<AuthoredSkillEvaluationCase> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/evaluation-cases`,
    "POST",
    "Failed to save evaluation case",
    input,
  );
}

export async function deleteSkillEvaluationCase(
  skillId: string,
  caseId: string,
  projectId?: string,
): Promise<void> {
  await skillRequest(
    `${skillDocumentPath(skillId, projectId)}/evaluation-cases/${encodeURIComponent(caseId)}`,
    "DELETE",
    "Failed to delete evaluation case",
  );
}

export function fetchSkillEvaluationResults(
  skillId: string,
  projectId?: string,
): Promise<{ results: AuthoredSkillEvaluationResult[] }> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/evaluations`,
    "GET",
    "Failed to load evaluation results",
  );
}

export function runSkillEvaluation(
  skillId: string,
  input: AuthoredSkillEvaluationRunInput,
  projectId?: string,
): Promise<AuthoredSkillEvaluationResult> {
  return skillRequest(
    `${skillDocumentPath(skillId, projectId)}/evaluations`,
    "POST",
    "Failed to run skill evaluation",
    input,
  );
}

import type {
  AuthoredSkillDocument,
  AuthoredSkillDraftInput,
  AuthoredSkillHistoryResponse,
  AuthoredSkillImportInput,
  AuthoredSkillPromotionInput,
  AuthoredSkillRollbackInput,
  AuthoredSkillVersionedDocument,
  SkillAvailability,
  SkillAvailabilityResponse,
  TeachingSkillDraftInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
}

function skillDocumentBasePath(skillId: string, projectId?: string): string {
  const encodedSkillId = encodeURIComponent(skillId);

  return projectId
    ? `/projects/${encodeURIComponent(projectId)}/skills/${encodedSkillId}`
    : `/skills/documents/${encodedSkillId}`;
}

export async function getSkill(
  skillId: string,
  projectId?: string,
): Promise<AuthoredSkillDocument> {
  const response = await fetchApi(skillDocumentBasePath(skillId, projectId), {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load skill");
  }

  return returnFetchedData<AuthoredSkillDocument>(response);
}

export async function getSkillHistory(
  skillId: string,
  projectId?: string,
): Promise<AuthoredSkillHistoryResponse> {
  const response = await fetchApi(`${skillDocumentBasePath(skillId, projectId)}/history`, {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load skill history");
  }

  return returnFetchedData<AuthoredSkillHistoryResponse>(response);
}

export async function saveSkillDraft(
  skillId: string,
  input: AuthoredSkillDraftInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  const response = await fetchApi(`${skillDocumentBasePath(skillId, projectId)}/draft`, {
    method: "PUT",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to save skill draft");
  }

  return returnFetchedData<AuthoredSkillVersionedDocument>(response);
}

export async function promoteSkillDraft(
  skillId: string,
  input: AuthoredSkillPromotionInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  const response = await fetchApi(`${skillDocumentBasePath(skillId, projectId)}/promote`, {
    method: "POST",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to publish skill revision");
  }

  return returnFetchedData<AuthoredSkillVersionedDocument>(response);
}

export async function rollbackSkill(
  skillId: string,
  input: AuthoredSkillRollbackInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  const response = await fetchApi(`${skillDocumentBasePath(skillId, projectId)}/rollback`, {
    method: "POST",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to roll the skill back");
  }

  return returnFetchedData<AuthoredSkillVersionedDocument>(response);
}

export async function importSkill(
  input: AuthoredSkillImportInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  const path = projectId
    ? `/projects/${encodeURIComponent(projectId)}/skills/import`
    : "/skills/documents/import";
  const response = await fetchApi(path, {
    method: "POST",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to import skill");
  }

  return returnFetchedData<AuthoredSkillVersionedDocument>(response);
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

export async function createTeachingSkillDraft(
  input: TeachingSkillDraftInput,
): Promise<AuthoredSkillVersionedDocument> {
  const response = await fetchApi("/skills/teaching-drafts", {
    method: "POST",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to save teaching draft");
  }

  return returnFetchedData<AuthoredSkillVersionedDocument>(response);
}

export async function deleteSkill(skillId: string, projectId?: string): Promise<void> {
  const encodedSkillId = encodeURIComponent(skillId);
  const path = projectId
    ? `/projects/${encodeURIComponent(projectId)}/skills/${encodedSkillId}`
    : `/skills/documents/${encodedSkillId}`;
  const response = await fetchApi(path, {
    method: "DELETE",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to delete skill");
  }
}

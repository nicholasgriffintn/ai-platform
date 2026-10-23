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
  SkillOutcomeSummary,
  ListPage,
  TeachingSkillDraftInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";
import { requestJson, resource } from "./resource.js";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
}

function skillDocumentPath(skillId: string, projectId?: string, suffix = ""): string {
  return withProjectScope(`/skills/documents/${encodeURIComponent(skillId)}${suffix}`, projectId);
}

export async function getSkill(
  skillId: string,
  projectId?: string,
): Promise<AuthoredSkillDocument> {
  const response = await fetchApi(skillDocumentPath(skillId, projectId), {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load skill");
  }

  return returnFetchedData<AuthoredSkillDocument>(response);
}

export async function getSkillOutcomes(
  skillId: string,
  projectId?: string,
): Promise<SkillOutcomeSummary> {
  const response = await fetchApi(skillDocumentPath(skillId, projectId, "/outcomes"), {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load skill outcomes");
  }

  return returnFetchedData<SkillOutcomeSummary>(response);
}

export async function getSkillHistory(
  skillId: string,
  projectId?: string,
): Promise<AuthoredSkillHistoryResponse> {
  const history = await requestJson<
    ListPage<AuthoredSkillHistoryResponse["revisions"][number]> &
      Pick<AuthoredSkillHistoryResponse, "skill" | "state">
  >(skillDocumentPath(skillId, projectId, "/revisions"), "GET");

  return { skill: history.skill, state: history.state, revisions: history.data };
}

export async function saveSkillDraft(
  skillId: string,
  input: AuthoredSkillDraftInput,
  projectId?: string,
): Promise<AuthoredSkillVersionedDocument> {
  const response = await fetchApi(skillDocumentPath(skillId, projectId, "/draft"), {
    method: "PATCH",
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
  const response = await fetchApi(skillDocumentPath(skillId, projectId, "/promote"), {
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
  const response = await fetchApi(skillDocumentPath(skillId, projectId, "/rollback"), {
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
  const path = withProjectScope("/skills/documents", projectId);
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
  return { skills: await resource<SkillAvailability>("/skills").listAll() };
}

export function setPersonalSkillEnabled(
  skillId: string,
  enabled: boolean,
): Promise<SkillAvailability> {
  return requestJson<SkillAvailability>(`/skills/${encodeURIComponent(skillId)}`, "PATCH", {
    enabled,
  });
}

export async function createSkill(
  content: string,
  projectId?: string,
): Promise<AuthoredSkillDocument> {
  const path = withProjectScope("/skills/documents", projectId);
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
  const response = await fetchApi("/skills/documents", {
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
  const path = skillDocumentPath(skillId, projectId);
  const response = await fetchApi(path, {
    method: "DELETE",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to delete skill");
  }
}

import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AuthoredSkillDocument,
  SkillAvailability,
  SkillAvailabilityResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
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

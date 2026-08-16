import type { SkillAvailability, SkillAvailabilityResponse } from "@ngriffin_uk/polychat-schemas";
import {
	createApiErrorFromResponse,
	returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

async function readHeaders(): Promise<Record<string, string>> {
	return (await apiService.getHeaders()) as Record<string, string>;
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
	const response = await fetchApi(`/skills/${encodeURIComponent(skillId)}`, {
		method: "PUT",
		headers: await readHeaders(),
		body: { enabled },
	});
	if (!response.ok) {
		throw await createApiErrorFromResponse(response, "Failed to update skill");
	}
	return returnFetchedData<SkillAvailability>(response);
}
